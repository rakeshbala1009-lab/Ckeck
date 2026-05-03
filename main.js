const { default: makeWASocket, useMultiFileAuthState, makeCacheableSignalKeyStore, delay, DisconnectReason } = require("@whiskeysockets/baileys");
const pino = require("pino");
const readline = require("readline");

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

function askNumber() {
    return new Promise((resolve) => {
        rl.question("📱 Enter WhatsApp Number (e.g. 8801XXXXXXXXX): ", (num) => {
            resolve(num.replace(/[^0-9]/g, ""));
        });
    });
}

async function start() {
    const number = await askNumber();

    const { state, saveCreds } = await useMultiFileAuthState("./session");

    const sock = makeWASocket({
        auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "silent" }))
        },
        printQRInTerminal: false,
        logger: pino({ level: "silent" }),
        browser: ["Ubuntu", "Chrome", "20.0"],
        keepAliveIntervalMs: 10000 // 🔥 keep alive
    });

    sock.ev.on("creds.update", saveCreds);

    let codeSent = false;

    sock.ev.on("connection.update", async (update) => {
        const { connection, lastDisconnect } = update;

        if (connection === "connecting" && !codeSent) {
            codeSent = true;

            try {
                await delay(1000);

                const code = await sock.requestPairingCode(number);

                console.log("\n🔑 Pairing Code:\n", code);
                console.log("\n👉 Enter quickly in WhatsApp!\n");

            } catch (err) {
                console.log("❌ Pairing error:", err);
            }
        }

        if (connection === "open") {
            console.log("✅ Connected Successfully!");
        }

        if (connection === "close") {
            const reason = lastDisconnect?.error?.output?.statusCode;

            console.log("❌ Connection closed, reason:", reason);

            // 🔥 AUTO RECONNECT
            if (reason !== DisconnectReason.loggedOut) {
                console.log("🔄 Reconnecting...");
                start();
            }
        }
    });
}

start();
