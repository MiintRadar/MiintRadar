const axios = require('axios');
const { Keypair, Connection, PublicKey } = require('@solana/web3.js');
const bs58 = require('bs58');
const fs = require('fs');

const TELEGRAM_TOKEN = "8594929956:AAH64duWvXamKOC9ygn0kxKQNKjVkGIv0Pw";
const WALLET_DB_FILE = 'users_wallets.json';
const connection = new Connection("https://api.mainnet-beta.solana.com");

const encode = typeof bs58.encode === 'function' ? bs58.encode : bs58.default.encode;
const decode = typeof bs58.decode === 'function' ? bs58.decode : bs58.default.decode;

if (!fs.existsSync(WALLET_DB_FILE)) fs.writeFileSync(WALLET_DB_FILE, '{}');

const getUserData = (userId) => {
    let db = {};
    try {
        db = JSON.parse(fs.readFileSync(WALLET_DB_FILE, 'utf8'));
    } catch (e) {
        console.error("DB Read Error, resetting...");
        db = {};
    }
    
    if (!db[userId]) {
        db[userId] = {
            wallets: [],
            settings: { slippage: 15, priorityFee: 0.001 },
            positions: []
        };
        for (let i = 0; i < 5; i++) {
            const kp = Keypair.generate();
            db[userId].wallets.push({
                index: i + 1,
                publicKey: kp.publicKey.toBase58(),
                secretKey: encode(kp.secretKey),
                active: i === 0
            });
        }
        fs.writeFileSync(WALLET_DB_FILE, JSON.stringify(db, null, 2));
    }
    return db[userId];
};

const getBalance = async (pubkeyStr) => {
    try {
        const balance = await connection.getBalance(new PublicKey(pubkeyStr));
        return balance / 1e9;
    } catch (e) { return 0; }
};

const sendDashboard = async (chatId, userId, ca) => {
    const userData = getUserData(userId);
    const activeWallet = userData.wallets.find(w => w.active) || userData.wallets[0];
    const balance = await getBalance(activeWallet.publicKey);
    
    let mcap = "N/A", price = "N/A", name = "Token", sym = "???";
    try {
        const res = await axios.get(`https://api.dexscreener.com/latest/dex/tokens/${ca}`);
        const p = res.data.pairs?.[0];
        if (p) {
            mcap = p.fdv || p.marketCap;
            price = p.priceUsd;
            name = p.baseToken.name;
            sym = p.baseToken.symbol;
        }
    } catch(e) { }

    const text = 
`💎 *${name} ($${sym})*
📍 \`${ca}\`

💰 *Price:* \`$${price}\` | 💡 *MCap:* \`$${Number(mcap).toLocaleString()}\`
💳 *Wallet:* \`W${activeWallet.index}\` (\`${balance.toFixed(3)} SOL\`)
⚙️ *Slippage:* \`${userData.settings.slippage}%\` | ⚡️ *Tip:* \`${userData.settings.priorityFee} SOL\`

---
*Execute Actions:*`;

    const keyboard = {
        inline_keyboard: [
            [{ text: "🔄 Refresh", callback_data: `dash_refresh_${ca}` }, { text: "📍 Track", callback_data: `dash_track_${ca}` }],
            [{ text: "✏️ Slippage % (" + userData.settings.slippage + ")", callback_data: `set_slip_${ca}` }],
            [{ text: "🚀 Buy 0.2 SOL", callback_data: `buy_0.2_${ca}` }, { text: "🚀 Buy 0.5 SOL", callback_data: `buy_0.5_${ca}` }, { text: "🚀 Buy 1.0 SOL", callback_data: `buy_1.0_${ca}` }],
            [{ text: "🚀 Buy 2.0 SOL", callback_data: `buy_2.0_${ca}` }, { text: "🚀 Buy 5.0 SOL", callback_data: `buy_5.0_${ca}` }, { text: "🚀 Buy X SOL", callback_data: `buy_custom_${ca}` }],
            [{ text: "🔴 Sell 50%", callback_data: `sell_50_${ca}` }, { text: "🔴 Sell 100%", callback_data: `sell_100_${ca}` }],
            [{ text: "💳 Wallets", callback_data: "menu_wallets" }, { text: "❌ Close", callback_data: "menu_main" }]
        ]
    };

    await postToTG('sendMessage', { chat_id: chatId, text, parse_mode: 'Markdown', reply_markup: keyboard });
};

const sendWalletMenu = async (chatId, userId) => {
    const userData = getUserData(userId);
    let text = `🛡 *Your Sniper Wallets*\n\nSelect a wallet to manage.`;
    const keyboard = { inline_keyboard: [] };
    userData.wallets.forEach(w => {
        keyboard.inline_keyboard.push([{ text: `${w.active ? "✅" : "💳"} Wallet ${w.index} (${w.publicKey.slice(0,4)}...${w.publicKey.slice(-4)})`, callback_data: `view_wallet_${w.index}` }]);
    });
    keyboard.inline_keyboard.push([{ text: "◀️ Back", callback_data: "menu_main" }]);
    await postToTG('sendMessage', { chat_id: chatId, text, parse_mode: 'Markdown', reply_markup: keyboard });
};

async function postToTG(method, data) {
    try { 
        await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/${method}`, data);
    } catch (e) {
        console.error(`TG Error (${method}):`, e.response?.data || e.message);
    }
}

const pollUpdates = async () => {
    let lastUpdateId = 0;
    console.log("Core V1.2.3 Starting - Debug Active...");
    while (true) {
        try {
            const res = await axios.get(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/getUpdates?offset=${lastUpdateId + 1}&timeout=30`);
            const updates = res.data.result;
            for (const update of updates) {
                lastUpdateId = update.update_id;
                const chatId = update.message?.chat.id || update.callback_query?.message.chat.id;
                const userId = update.message?.from.id || update.callback_query?.from.id;
                if (!chatId) continue;

                if (update.message?.text) {
                    const text = update.message.text.trim();
                    console.log(`[MSG] ${userId}: ${text}`);
                    if (text === '/start') { 
                         await postToTG('sendMessage', { chat_id: chatId, text: "⚡️ *MiintRadar Console Initialized*\n\nPaste a CA to begin.", parse_mode: 'Markdown' });
                    } else if (text === '/wallets') {
                        await sendWalletMenu(chatId, userId);
                    } else if (text.length >= 32 && text.length <= 44) {
                        await sendDashboard(chatId, userId, text);
                    }
                } else if (update.callback_query) {
                    const data = update.callback_query.data;
                    console.log(`[CALLBACK] ${userId}: ${data}`);
                    
                    if (data === 'menu_wallets') await sendWalletMenu(chatId, userId);
                    if (data === 'menu_main') await postToTG('sendMessage', { chat_id: chatId, text: "⚡️ *Main Menu*\nPaste a CA to trade.", parse_mode: 'Markdown' });
                    
                    if (data.startsWith('view_wallet_')) {
                        const idx = parseInt(data.split('_')[2]);
                        const userData = getUserData(userId);
                        const wallet = userData.wallets.find(w => w.index === idx);
                        const balance = await getBalance(wallet.publicKey);
                        const text = `💳 *Wallet ${idx} Settings*\n\nAddress: \`${wallet.publicKey}\`\nBalance: \`${balance.toFixed(3)} SOL\``;
                        const kb = {
                            inline_keyboard: [
                                [{ text: wallet.active ? "✅ Active" : "✨ Activate", callback_data: `select_wallet_${idx}` }],
                                [{ text: "🔑 Export Private Key", callback_data: `export_key_${idx}` }],
                                [{ text: "◀️ Back", callback_data: "menu_wallets" }]
                            ]
                        };
                        await postToTG('sendMessage', { chat_id: chatId, text, parse_mode: 'Markdown', reply_markup: kb });
                    }

                    if (data.startsWith('select_wallet_')) {
                        const idx = parseInt(data.split('_')[2]);
                        const db = JSON.parse(fs.readFileSync(WALLET_DB_FILE, 'utf8'));
                        db[userId].wallets.forEach(w => w.active = (w.index === idx));
                        fs.writeFileSync(WALLET_DB_FILE, JSON.stringify(db, null, 2));
                        await postToTG('answerCallbackQuery', { callback_query_id: update.callback_query.id, text: `Wallet ${idx} set as primary.` });
                        await sendWalletMenu(chatId, userId);
                    }

                    if (data.startsWith('export_key_')) {
                        const idx = parseInt(data.split('_')[2]);
                        const userData = getUserData(userId);
                        const wallet = userData.wallets.find(w => w.index === idx);
                        await postToTG('sendMessage', { chat_id: chatId, text: `🔑 *Wallet ${idx} Private Key:*\n\n\`${wallet.secretKey}\``, parse_mode: 'Markdown' });
                    }

                    await postToTG('answerCallbackQuery', { callback_query_id: update.callback_query.id });
                }
            }
        } catch (e) { 
            console.error("Poll cycle error:", e.message);
            await new Promise(r => setTimeout(r, 5000)); 
        }
    }
};

pollUpdates();
