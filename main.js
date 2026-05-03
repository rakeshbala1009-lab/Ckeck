const TelegramBot = require('node-telegram-bot-api');
const { default: Venocyber_Tech, useMultiFileAuthState, delay, makeCacheableSignalKeyStore } = require("maher-zubair-baileys");
const fs = require('fs');
const pino = require("pino");

// 🔴 PUT YOUR BOT TOKEN HERE
const bot = new TelegramBot("8734346705:AAEk2u_PUM5Wr9cMdpcF69Punh0LmOj3iTI", { polling: true });

// random id generator
function makeid(length = 6) {
    let result = '';
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

function removeFile(path) {
    if (fs.existsSync(path)) {
        fs.rmSync(path, { recursive: true, force: true });
    }
}

// start command
bot.onText(/\/start/, (msg) => {
    bot.sendMessage(msg.chat.id, "Send your number like:\n\n`/pair 8801XXXXXXXXX`", {
        parse_mode: "Markdown"
    });
});

// pair command
bot.onText(/\/pair (.+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    let num = match[1];

    if (!num) {
        return bot.sendMessage(chatId, "❌ Please provide a number.");
    }

    num = num.replace(/[^0-9]/g, '');

    if (num.length < 10) {
        return bot.sendMessage(chatId, "❌ Invalid number format.");
    }

    const id = makeid();
    const sessionPath = './temp/' + id;

    try {
        const { state, saveCreds } = await useMultiFileAuthState(sessionPath);

        const sock = Venocyber_Tech({
            auth: {
                creds: state.creds,
                keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "fatal" }))
            },
            printQRInTerminal: false,
            logger: pino({ level: "fatal" }),
            browser: ["Chrome (Linux)", "", ""]
        });

        if (!sock.authState.creds.registered) {
            await delay(1500);

            const code = await sock.requestPairingCode(num);
            await bot.sendMessage(chatId, `🔑 Pairing Code:\n\n${code}`);
        }

        sock.ev.on('creds.update', saveCreds);

        sock.ev.on("connection.update", async (update) => {
            const { connection } = update;

            if (connection === "open") {
                await delay(4000);

                let data = fs.readFileSync(`${sessionPath}/creds.json`);
                let b64 = Buffer.from(data).toString('base64');

                await bot.sendMessage(chatId, "✅ Connected!\n\nHere is your session:");
                await bot.sendMessage(chatId, b64);

                removeFile(sessionPath);
                await sock.ws.close();
            }

            if (connection === "close") {
                removeFile(sessionPath);
            }
        });

    } catch (err) {
        console.log(err);
        removeFile(sessionPath);
        bot.sendMessage(chatId, "❌ Error generating pairing code.");
    }
});
