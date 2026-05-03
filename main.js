const TelegramBot = require('node-telegram-bot-api');
const { default: makeWASocket, useMultiFileAuthState, delay, makeCacheableSignalKeyStore } = require("@whiskeysockets/baileys");
const pino = require("pino");
const fs = require("fs");

// 🔴 Telegram token
const bot = new TelegramBot("8734346705:AAEk2u_PUM5Wr9cMdpcF69Punh0LmOj3iTI", { polling: true });

// 🔐 Only you
const ALLOWED_USERS = [6058266328];

// random id
function makeid(length = 6) {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    let result = "";
    for (let i = 0; i < length; i++) {
        result += chars[Math.floor(Math.random() * chars.length)];
    }
    return result;
}

// start
bot.onText(/\/start/, (msg) => {
    if (!ALLOWED_USERS.includes(msg.from.id)) {
        return bot.sendMessage(msg.chat.id, "⛔ Access Denied");
    }

    bot.sendMessage(msg.chat.id, "Send:\n/pair 8801XXXXXXXXX");
});

// pair command
bot.onText(/\/pair (.+)/, async (msg, match) => {
    const chatId = msg.chat.id;

    if (!ALLOWED_USERS.includes(msg.from.id)) {
        return bot.sendMessage(chatId, "⛔ Unauthorized");
    }

    let number = match[1].replace(/[^0-9]/g, '');

    if (!number || number.length < 10) {
        return bot.sendMessage(chatId, "❌ Invalid number");
    }

    const sessionId = makeid();
    const path = "./sessions/" + sessionId;

    await bot.sendMessage(chatId, "⏳ Connecting...");

    const { state, saveCreds } = await useMultiFileAuthState(path);

    const sock = makeWASocket({
        auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "silent" }))
        },
        printQRInTerminal: false,
        logger: pino({ level: "silent" }),
        browser: ["Ubuntu", "Chrome", "20.0"]
    });

    // save creds
    sock.ev.on("creds.update", saveCreds);

    // 🔥 MAIN FIX: pairing inside connection event
    sock.ev.on("connection.update", async (update) => {
        const { connection, qr } = update;

        if (connection === "connecting" || qr) {
            try {
                const code = await sock.requestPairingCode(number);
                await bot.sendMessage(chatId, `🔑 Pair Code:\n\n${code}\n\n👉 WhatsApp → Linked Devices → Link with phone number`);
            } catch (e) {
                console.log(e);
                bot.sendMessage(chatId, "❌ Failed to generate code");
            }
        }

        if (connection === "open") {
            await bot.sendMessage(chatId, "✅ WhatsApp Connected!");
        }

        if (connection === "close") {
            console.log("❌ Connection closed");
        }
    });
});
