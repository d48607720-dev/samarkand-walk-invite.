# samarkand-walk-invite

Telegram-мини-апп: открытка для Альбины (конверт, 10 лёгких вопросов, предупреждение,
10 вопросов про прогулку по Самарканду, календарь). Ответ приходит Давиду в личку.
Лимит: 2 прохождения. Доступ только у двух ID.

## Запуск (5 минут)

1. Telegram, @BotFather: /newbot, имя и username, скопируй токен.
2. GitHub: создай репозиторий `samarkand-walk-invite`, залей все файлы.
3. Railway: New Project, Deploy from GitHub repo, выбери репозиторий.
4. Railway, Variables: добавь `BOT_TOKEN` (токен от BotFather).
5. Railway, Settings, Networking: Generate Domain. Если ссылка не подхватилась сама,
   добавь переменную `WEBAPP_URL` = `https://твой-домен.up.railway.app`.
6. Чтобы счётчик попыток не сбрасывался при деплое: Railway, Volume, mount path `/data`,
   и переменная `DATA_DIR=/data`.
7. ВАЖНО: и Давид, и Альбина должны один раз нажать /start у бота, иначе бот не сможет им писать.
8. Сначала проверь сам: открой бота, пройди открытку. Тест не тратит попытки, ответ придёт тебе.

## Что менять
- Места и кафе: массивы `PARKS` и `CAFES` в начале скрипта в `public/index.html`.
- Вопросы: `QUIZ1` и `QUIZ2` там же.
- ID и лимит: переменные `OWNER_ID`, `GIRL_ID`, `MAX_USES`.
