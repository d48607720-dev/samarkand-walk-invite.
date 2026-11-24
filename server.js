// Открытка для Альбины — сервер + Telegram-бот (Node 18+, без зависимостей)
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const BOT_TOKEN = process.env.BOT_TOKEN;
const OWNER_ID = Number(process.env.OWNER_ID || 7948603698); // Давид
const GIRL_ID = Number(process.env.GIRL_ID || 8660771174);   // Альбина
const MAX_USES = Number(process.env.MAX_USES || 2);
const PORT = Number(process.env.PORT || 3000);
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const WEBAPP_URL =
  process.env.WEBAPP_URL ||
  (process.env.RAILWAY_PUBLIC_DOMAIN ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}` : '');

if (!BOT_TOKEN) {
  console.error('Нет BOT_TOKEN. Добавь переменную в Railway → Variables.');
  process.exit(1);
}

/* ---------- простое хранилище ---------- */
const STATE_FILE = path.join(DATA_DIR, 'state.json');
let state = { uses: {}, opened: false };
try {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  state = { ...state, ...JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')) };
} catch (_) {}
const save = () => {
  try { fs.writeFileSync(STATE_FILE, JSON.stringify(state)); } catch (e) { console.error('save', e.message); }
};

/* ---------- Telegram ---------- */
async function tg(method, body) {
  const r = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body || {}),
  });
  return r.json();
}
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const clip = (s, n) => String(s ?? '').slice(0, n);

async function sendLong(chat_id, text) {
  const chunks = [];
  let cur = '';
  for (const line of text.split('\n')) {
    if ((cur + line + '\n').length > 3800) { chunks.push(cur); cur = ''; }
    cur += line + '\n';
  }
  if (cur.trim()) chunks.push(cur);
  for (const c of chunks) await tg('sendMessage', { chat_id, text: c, parse_mode: 'HTML' });
}

function verifyInitData(initData) {
  if (!initData) return null;
  const params = new URLSearchParams(initData);
  const hash = params.get('hash');
  if (!hash) return null;
  params.delete('hash');
  const dcs = [...params.entries()].map(([k, v]) => `${k}=${v}`).sort().join('\n');
  const secret = crypto.createHmac('sha256', 'WebAppData').update(BOT_TOKEN).digest();
  const calc = crypto.createHmac('sha256', secret).update(dcs).digest('hex');
  const a = Buffer.from(calc), b = Buffer.from(hash);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  const age = Date.now() / 1000 - Number(params.get('auth_date') || 0);
  if (age > 86400) return null;
  try { return JSON.parse(params.get('user')); } catch (_) { return null; }
}

/* ---------- API ---------- */
function auth(body) {
  const user = verifyInitData(body.initData);
  if (!user) return { err: [401, 'open_in_telegram'] };
  if (user.id !== GIRL_ID && user.id !== OWNER_ID) return { err: [403, 'not_allowed'] };
  return { user };
}
const remainingFor = (id) => (id === OWNER_ID ? 99 : Math.max(0, MAX_USES - (state.uses[id] || 0)));

async function handleApi(route, body) {
  const { user, err } = auth(body);
  if (err) return { code: err[0], json: { error: err[1] } };

  if (route === '/api/status') {
    if (user.id === GIRL_ID && !state.opened) {
      state.opened = true; save();
      tg('sendMessage', { chat_id: OWNER_ID, text: '💌 Альбина открыла твою открытку.' }).catch(() => {});
    }
    return { code: 200, json: { remaining: remainingFor(user.id), test: user.id === OWNER_ID } };
  }

  if (route === '/api/decline') {
    if (user.id === GIRL_ID) {
      tg('sendMessage', { chat_id: OWNER_ID, text: 'Альбина прошла первую часть, а на предупреждении решила остановиться. Всё в порядке, просто не дави 🤝' }).catch(() => {});
    }
    return { code: 200, json: { ok: true } };
  }

  if (route === '/api/submit') {
    if (remainingFor(user.id) <= 0) return { code: 403, json: { error: 'used_up' } };
    const answers = Array.isArray(body.answers) ? body.answers.slice(0, 40) : [];
    const lines = [];
    const test = user.id === OWNER_ID;
    lines.push(test ? '🧪 <b>ТЕСТ (это ты сам)</b>' : '💌 <b>Альбина ответила на открытку!</b>');
    lines.push('');
    let part = 0;
    for (const a of answers) {
      if (a.part !== part) {
        part = a.part;
        lines.push(part === 1 ? '<b>— Про неё —</b>' : '\n<b>— Про прогулку по Самарканду —</b>');
      }
      lines.push(`▪️ ${esc(clip(a.q, 160))}\n   ➜ <i>${esc(clip(a.a, 500)) || '—'}</i>`);
    }
    lines.push('');
    lines.push(`📅 <b>Дата:</b> ${esc(clip(body.dateLabel, 60))}`);
    lines.push(`🕒 <b>Время:</b> ${esc(clip(body.time, 20))}`);
    lines.push(`💬 <b>Комментарий:</b> ${esc(clip(body.comment, 600)) || '—'}`);
    await sendLong(OWNER_ID, lines.join('\n'));

    if (!test) {
      state.uses[user.id] = (state.uses[user.id] || 0) + 1;
      save();
      tg('sendMessage', {
        chat_id: GIRL_ID,
        text: 'Спасибо, Альбина 💫 Давид получил твои ответы и скоро напишет сам.',
      }).catch(() => {});
    }
    return { code: 200, json: { ok: true, remaining: remainingFor(user.id) } };
  }
  return { code: 404, json: { error: 'not_found' } };
}

/* ---------- HTTP ---------- */
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml' };
const PUBLIC = path.join(__dirname, 'public');

http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://x');
    if (req.method === 'POST' && url.pathname.startsWith('/api/')) {
      let raw = '';
      for await (const ch of req) { raw += ch; if (raw.length > 200000) { res.writeHead(413).end(); return; } }
      let body = {};
      try { body = JSON.parse(raw || '{}'); } catch (_) {}
      const { code, json } = await handleApi(url.pathname, body);
      res.writeHead(code, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(json));
      return;
    }
    if (url.pathname === '/health') { res.writeHead(200).end('ok'); return; }
    let file = path.normalize(path.join(PUBLIC, url.pathname === '/' ? 'index.html' : url.pathname));
    if (!file.startsWith(PUBLIC) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(PUBLIC, 'index.html');
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    fs.createReadStream(file).pipe(res);
  } catch (e) {
    console.error(e);
    res.writeHead(500).end('error');
  }
}).listen(PORT, () => console.log('Server on', PORT, 'WebApp:', WEBAPP_URL || '(нет URL)'));

/* ---------- Бот (long polling) ---------- */
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function onMessage(m) {
  const id = m.from && m.from.id;
  if (!m.text || !m.text.startsWith('/start')) return;
  if (id !== GIRL_ID && id !== OWNER_ID) {
    await tg('sendMessage', { chat_id: m.chat.id, text: 'Эта открытка личная, она не для тебя 🙂' });
    return;
  }
  if (!WEBAPP_URL) {
    await tg('sendMessage', { chat_id: m.chat.id, text: 'Адрес приложения ещё не настроен (WEBAPP_URL).' });
    return;
  }
  const text = id === GIRL_ID
    ? 'Привет, Альбина! 🌙 Давид приготовил для тебя маленькую открытку. Нажми кнопку ниже.'
    : 'Режим теста. Открой открытку и пройди её сам — ответ придёт сюда, счётчик попыток не тратится.';
  await tg('sendMessage', {
    chat_id: m.chat.id,
    text,
    reply_markup: { inline_keyboard: [[{ text: '💌 Открыть открытку', web_app: { url: WEBAPP_URL } }]] },
  });
  tg('setChatMenuButton', { chat_id: m.chat.id, menu_button: { type: 'web_app', text: '💌 Открытка', web_app: { url: WEBAPP_URL } } }).catch(() => {});
}

(async function poll() {
  await tg('deleteWebhook').catch(() => {});
  let offset = 0;
  for (;;) {
    try {
      const r = await tg('getUpdates', { offset, timeout: 30, allowed_updates: ['message'] });
      if (!r.ok) { console.error('getUpdates', r.description); await sleep(5000); continue; }
      for (const u of r.result) {
        offset = u.update_id + 1;
        if (u.message) onMessage(u.message).catch((e) => console.error(e.message));
      }
    } catch (e) {
      console.error('poll', e.message);
      await sleep(3000);
    }
  }
})();
