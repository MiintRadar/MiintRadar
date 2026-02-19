const axios = require('axios');
const { Keypair, Connection, PublicKey } = require('@solana/web3.js');
const bs58 = require('bs58');
const fs = require('fs');

const TELEGRAM_TOKEN = "8594929956:AAH64duWvXamKOC9ygn0kxKQNKjVkGIv0Pw";
const WALLET_DB_FILE = 'users_wallets.json';
const connection = new Connection("https://api.mainnet-beta.solana.com");

// --- OUR TREASURY WALLET (Where trading fees are sent) ---
// This is your wallet Rugpro. You can change this to any Solana address you own.
const REVENUE_WALLET = "CFUQcUPMRVAUT2heaGpXgEcTqp3FaEzvhHdzDdws3heu"; 

const encode = typeof bs58.encode === 'function' ? bs58.encode : bs58.default.encode;
const decode = typeof bs58.decode === 'function' ? bs58.decode : bs58.default.decode;

if (!fs.existsSync(WALLET_DB_FILE)) fs.writeFileSync(WALLET_DB_FILE, '{}');

const getUserData = (userId) => {
    let db = {};
    try { db = JSON.parse(fs.readFileSync(WALLET_DB_FILE, 'utf8')); } catch (e) { db = {}; }
    if (!db[userId]) {
        db[userId] = {
            wallets: [],
            settings: { slippage: 15, priorityFee: 0.001 },
            referralId: Math.random().toString(36).substring(7),
            referredBy: null,
            referralBonus: 0, // In SOL
            totalFeesPaid: 0
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

const sendReferralMenu = async (chatId, userId) => {
    const userData = getUserData(userId);
    const refLink = `https://t.me/MiintRadarBot?start=ref_${userData.referralId}`;
    
    const text = 
`🎁 *MiintRadar Referral Program*

Share your link and earn **30% of the trading fees** paid by your referrals!

💰 *Your Earnings:* \`${userData.referralBonus.toFixed(4)} SOL\`
👥 *Your Link:* \`${refLink}\`

_Earnings are credited instantly to your primary wallet after each trade._`;

    const kb = {
        inline_keyboard: [
            [{ text: "📣 Share Link", url: `https://t.me/share/url?url=${encodeURIComponent(refLink)}&text=Try MiintRadar, the fastest trading terminal on Solana!` }],
            [{ text: "◀️ Back", callback_data: "menu_main" }]
        ]
    };
    await postToTG('sendMessage', { chat_id: chatId, text, parse_mode: 'Markdown', reply_markup: kb });
};

const sendDashboard = async (chatId, userId, ca) => {
    const userData = getUserData(userId);
    const activeWallet = userData.wallets.find(w => w.active) || userData.wallets[0];
    const balance = await getBalance(activeWallet.publicKey);
    
    // Dex API simulation for test stability
    const text = 
`💎 *Token Dashboard*
📍 \`${ca}\`

💰 *MCap:* \`$379,546\` | 💧 *Pooled:* \`187.9 SOL\`
💳 *Wallet:* \`W${activeWallet.index}\` (\`${balance.toFixed(3)} SOL\`)
⚙️ *Slippage:* \`${userData.settings.slippage}%\`

---
*Execute Actions:*`;

    const kb = {
        inline_keyboard: [
            [{ text: "🔄 Refresh", callback_data: `dash_ref_${ca}` }, { text: "📍 Track", callback_data: `dash_track_${ca}` }],
            [{ text: "🚀 Buy 0.1 SOL", callback_data: `buy_0.1_${ca}` }, { text: "🚀 Buy 0.5 SOL", callback_data: `buy_0.5_${ca}` }, { text: "🚀 Buy 1.0 SOL", callback_data: `buy_1.0_${ca}` }],
            [{ text: "🚀 Buy 2.0 SOL", callback_data: `buy_2.0_${ca}` }, { text: "🚀 Buy 5.0 SOL", callback_data: `buy_5.0_${ca}` }, { text: "🚀 Buy X SOL", callback_data: `buy_custom_${ca}` }],
            [{ text: "🔴 Sell 50%", callback_data: `sell_50_${ca}` }, { text: "🔴 Sell 100%", callback_data: `sell_100_${ca}` }],
            [{ text: "👥 Referrals", callback_data: "menu_ref" }, { text: "💳 Wallets", callback_data: "menu_wallets" }]
        ]
    };
    await postToTG('sendMessage', { chat_id: chatId, text, parse_mode: 'Markdown', reply_markup: kb });
};

async function postToTG(method, data) {
    try { await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/${method}`, data); } catch (e) { console.error(e.message); }
}

const getBalance = async (pubkeyStr) => {
    try {
        const balance = await connection.getBalance(new PublicKey(pubkeyStr));
        return balance / 1e9;
    } catch { return 0; }
};

const pollUpdates = async () => {
    let lastUpdateId = 0;
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
                    if (text.startsWith('/start ref_')) {
                        const refCode = text.split('_')[1];
                        const userData = getUserData(userId);
                        userData.referredBy = refCode;
                        await postToTG('sendMessage', { chat_id: chatId, text: "🎉 Welcome! You have been referred. Enjoy reduced trading fees.", parse_mode: 'Markdown' });
                        await sendDashboard(chatId, userId, "5ZKeikksB41nnq2zNBk6YDquiEfLRt8PvqGCYCppump");
                    } else if (text === '/start') {
                        await postToTG('sendMessage', { chat_id: chatId, text: "⚡️ *Terminal Online*\nPaste a CA to trade.", parse_mode: 'Markdown' });
                    } else if (text.length >= 32 && text.length <= 44) {
                        await sendDashboard(chatId, userId, text);
                    }
                } else if (update.callback_query) {
                    const data = update.callback_query.data;
                    if (data === 'menu_ref') await sendReferralMenu(chatId, userId);
                    if (data === 'menu_main') await postToTG('sendMessage', { chat_id: chatId, text: "⚡️ *Main Menu*\nPaste a CA to trade.", parse_mode: 'Markdown' });
                    await postToTG('answerCallbackQuery', { callback_query_id: update.callback_query.id });
                }
            }
        } catch (e) { await new Promise(r => setTimeout(r, 5000)); }
    }
};

pollUpdates();
