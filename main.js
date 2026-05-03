const TelegramBot = require('node-telegram-bot-api');
const { default: makeWASocket, useMultiFileAuthState, delay, makeCacheableSignalKeyStore } = require("@whiskeysockets/baileys");
const fs = require("fs");
const pino = require("pino");

// 🔴 Telegram Bot Token এখানে বসাও
const bot = new TelegramBot("8734346705:AAEk2u_PUM5Wr9cMdpcF69Punh0LmOj3iTI", { polling: true });

// 🔐 তোমার Telegram ID (only you can use)
const ALLOWED_USERS = [6058266328];

// random session id
function makeid(length = 6) {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    let result = "";
    for (let i = 0; i < length; i++) {
        result += chars[Math.floor(Math.random() * chars.length)];
    }
    return result;
}

// delete session folder
function removeFile(path) {
    if (fs.existsSync(path)) {
        fs.rmSync(path, { recursive: true, force: true });
    }
}

// /start command
bot.onText(/\/start/, (msg) => {
    if (!ALLOWED_USERS.includes(msg.from.id)) {
        return bot.sendMessage(msg.chat.id, "⛔ Access Denied");
    }

    bot.sendMessage(msg.chat.id, "✅ Bot Ready\n\nUse:\n/pair 8801XXXXXXXXX");
});

// /pair command
bot.onText(/\/pair (.+)/, async (msg, match) => {
    const chatId = msg.chat.id;

    if (!ALLOWED_USERS.includes(msg.from.id)) {
        return bot.sendMessage(chatId, "⛔ Unauthorized");
    }

    let number = match[1].replace(/[^0-9]/g, '');

    if (!number || number.length < 10) {
        return bot.sendMessage(chatId, "❌ Invalid number\nExample: /pair 8801XXXXXXXXX");
    }

    const sessionId = makeid();
    const sessionPath = "./sessions/" + sessionId;

    try {
        await bot.sendMessage(chatId, "⏳ Generating pairing code...");

        const { state, saveCreds } = await useMultiFileAuthState(sessionPath);

        const sock = makeWASocket({
            auth: {
                creds: state.creds,
                keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "silent" }))
            },
            printQRInTerminal: false,
            logger: pino({ level: "silent" }),
            browser: ["Ubuntu", "Chrome", "20.0"]
        });

        // generate pairing code
        if (!sock.authState.creds.registered) {
            await delay(1500);
            const code = await sock.requestPairingCode(number);

            await bot.sendMessage(chatId, `🔑 Pair Code:\n\n${code}\n\n👉 WhatsApp → Linked Devices → Link with phone number`);
        }

        // save session
        sock.ev.on("creds.update", saveCreds);

        // connection status
        sock.ev.on("connection.update", async (update) => {
            const { connection } = update;

            if (connection === "open") {
                await bot.sendMessage(chatId, "✅ WhatsApp Connected Successfully!");

                setTimeout(() => {
                    sock.ws.close();
                    removeFile(sessionPath);
                }, 5000);
            }

            if (connection === "close") {
                removeFile(sessionPath);
            }
        });

    } catch (err) {
        console.log(err);
        removeFile(sessionPath);
        bot.sendMessage(chatId, "❌ Failed to generate pairing code");
    }
});
