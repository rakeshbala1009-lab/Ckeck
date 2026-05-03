const { default: makeWASocket, useMultiFileAuthState, makeCacheableSignalKeyStore, delay } = require("@whiskeysockets/baileys");
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

    if (!number || number.length < 10) {
        console.log("❌ Invalid number");
        process.exit(0);
    }

    const { state, saveCreds } = await useMultiFileAuthState("./session");

    const sock = makeWASocket({
        auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "silent" }))
        },
        printQRInTerminal: false,
        logger: pino({ level: "silent" }),
        browser: ["Ubuntu", "Chrome", "20.0"]
    });

    sock.ev.on("creds.update", saveCreds);

    let pairingDone = false;

    sock.ev.on("connection.update", async (update) => {
        const { connection, receivedPendingNotifications } = update;

        // 🔥 IMPORTANT FIX
        if (!pairingDone && connection === "connecting") {
            try {
                pairingDone = true;

                await delay(1000); // ⚠️ required small wait

                const code = await sock.requestPairingCode(number);

                console.log("\n🔑 Pairing Code:\n");
                console.log(code);
                console.log("\n👉 WhatsApp → Linked Devices → Link with phone number\n");

            } catch (err) {
                console.log("❌ Pairing Failed");
                console.log(err);
                process.exit(0);
            }
        }

        if (connection === "open") {
            console.log("✅ Connected Successfully!");
        }

        if (connection === "close") {
            console.log("❌ Connection Closed");
        }
    });
}

start();
