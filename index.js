require('dotenv').config();
const axios = require('axios');
const { Keypair, Connection, PublicKey, Transaction, SystemProgram, LAMPORTS_PER_SOL } = require('@solana/web3.js');
const bs58 = require('bs58');
const fs = require('fs');

// --- CONFIG ---
// Set your bot token via environment variable or replace below
const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN || "YOUR_BOT_TOKEN_HERE";
const REVENUE_WALLET = process.env.REVENUE_WALLET || "YOUR_FEE_WALLET_HERE";
const WALLET_DB_FILE = 'users_wallets.json';
const connection = new Connection("https://api.mainnet-beta.solana.com");
const JUPITER_API = "https://quote-api.jup.ag/v6";

const encode = (data) => (typeof bs58.encode === 'function' ? bs58.encode(data) : bs58.default.encode(data));
const decode = (data) => (typeof bs58.decode === 'function' ? bs58.decode(data) : bs58.default.decode(data));

if (!fs.existsSync(WALLET_DB_FILE)) fs.writeFileSync(WALLET_DB_FILE, '{}');

// === DATABASE FUNCTIONS ===
const getUserData = (userId) => {
    let db = {};
    try { db = JSON.parse(fs.readFileSync(WALLET_DB_FILE, 'utf8')); } catch (e) { db = {}; }
    if (!db[userId]) {
        db[userId] = {
            wallets: [],
            settings: { slippage: 15, priorityFee: 0.001 },
            referralId: Math.random().toString(36).substring(7),
            totalBonus: 0,
            positions: {},
            totalTrades: 0,
            totalVolume: 0
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

const saveUserData = (userId, data) => {
    const db = JSON.parse(fs.readFileSync(WALLET_DB_FILE, 'utf8'));
    db[userId] = data;
    fs.writeFileSync(WALLET_DB_FILE, JSON.stringify(db, null, 2));
};

// === BALANCE FUNCTIONS ===
const getBalance = async (pubkeyStr) => {
    try {
        const balance = await connection.getBalance(new PublicKey(pubkeyStr));
        return (balance || 0) / LAMPORTS_PER_SOL;
    } catch { return 0; }
};

const getTokenBalance = async (walletPubkey, tokenMint) => {
    try {
        const accounts = await connection.getParsedTokenAccountsByOwner(
            new PublicKey(walletPubkey),
            { mint: new PublicKey(tokenMint) }
        );
        if (accounts.value.length > 0) {
            return accounts.value[0].account.data.parsed.info.tokenAmount.uiAmount || 0;
        }
        return 0;
    } catch { return 0; }
};

// === SWAP EXECUTION ===
const executeSwap = async (userId, ca, amount, isBuy = true) => {
    const userData = getUserData(userId);
    const wallet = userData.wallets.find(w => w.active) || userData.wallets[0];
    const balance = await getBalance(wallet.publicKey);
    
    // Check balance for buy
    if (isBuy && balance < amount) {
        return { success: false, error: "insufficient_balance", balance };
    }
    
    const keypair = Keypair.fromSecretKey(decode(wallet.secretKey));
    
    try {
        // Get Jupiter quote
        const SOL_MINT = "So11111111111111111111111111111111111111112";
        const inputMint = isBuy ? SOL_MINT : ca;
        const outputMint = isBuy ? ca : SOL_MINT;
        const amountLamports = Math.floor(amount * LAMPORTS_PER_SOL);
        
        const quoteRes = await axios.get(`${JUPITER_API}/quote`, {
            params: {
                inputMint,
                outputMint,
                amount: amountLamports,
                slippageBps: userData.settings.slippage * 100
            },
            timeout: 10000
        });
        
        if (!quoteRes.data) {
            return { success: false, error: "no_quote" };
        }
        
        // Get swap transaction
        const swapRes = await axios.post(`${JUPITER_API}/swap`, {
            quoteResponse: quoteRes.data,
            userPublicKey: wallet.publicKey,
            wrapAndUnwrapSol: true,
            prioritizationFeeLamports: userData.settings.priorityFee * LAMPORTS_PER_SOL
        }, { timeout: 10000 });
        
        if (!swapRes.data?.swapTransaction) {
            return { success: false, error: "no_swap_tx" };
        }
        
        // Deserialize and sign transaction
        const swapTransactionBuf = Buffer.from(swapRes.data.swapTransaction, 'base64');
        const transaction = Transaction.from(swapTransactionBuf);
        transaction.sign(keypair);
        
        // Send transaction
        const rawTransaction = transaction.serialize();
        const txid = await connection.sendRawTransaction(rawTransaction, {
            skipPreflight: true,
            maxRetries: 2
        });
        
        // Confirm transaction
        const confirmation = await connection.confirmTransaction(txid, 'confirmed');
        
        if (confirmation.value.err) {
            return { success: false, error: "tx_failed", txid };
        }
        
        // Calculate output amount
        const outputAmount = isBuy 
            ? quoteRes.data.outAmount / Math.pow(10, 6) // Assuming 6 decimals for token
            : quoteRes.data.outAmount / LAMPORTS_PER_SOL;
        
        // Update user stats
        userData.totalTrades++;
        userData.totalVolume += amount;
        saveUserData(userId, userData);
        
        return {
            success: true,
            txid,
            amount,
            outputAmount,
            isBuy,
            newBalance: await getBalance(wallet.publicKey)
        };
        
    } catch (e) {
        console.log("Swap error:", e.message);
        return { success: false, error: e.message };
    }
};

// === MAIN MENU ===
const sendMainMenu = async (chatId, userId) => {
    const userData = getUserData(userId);
    const wallet = userData.wallets.find(w => w.active) || userData.wallets[0];
    const balance = await getBalance(wallet.publicKey);
    
    const text = 
`🦀 *MiintRadar Terminal*

💳 *Wallet:* W${wallet.index}
💰 *Balance:* \`${(balance || 0).toFixed(4)} SOL\`
📊 *Total Trades:* ${userData.totalTrades || 0}
💸 *Volume:* \`${(userData.totalVolume || 0).toFixed(2)} SOL\``;

    const kb = {
        inline_keyboard: [
            [{ text: "💳 Wallets", callback_data: "menu_wallets" }, { text: "⚙️ Settings", callback_data: "menu_settings" }],
            [{ text: "👥 Referrals", callback_data: "menu_ref" }, { text: "📊 Positions", callback_data: "menu_positions" }],
            [{ text: "📈 Trending", callback_data: "menu_trending" }, { text: "💡 Help", callback_data: "menu_help" }]
        ]
    };
    await postToTG('sendMessage', { chat_id: chatId, text, parse_mode: 'Markdown', reply_markup: kb });
};

// === TRADING DASHBOARD ===
const sendDashboard = async (chatId, userId, ca) => {
    const userData = getUserData(userId);
    const wallet = userData.wallets.find(w => w.active) || userData.wallets[0];
    const balance = await getBalance(wallet.publicKey);
    const tokenBalance = await getTokenBalance(wallet.publicKey, ca);
    
    let stats = { name: "Token", sym: "???", mcap: 0, price: 0, pooled: 0, burned: "❌", priceChange: 0 };
    try {
        const res = await axios.get(`https://api.dexscreener.com/latest/dex/tokens/${ca}`, { timeout: 10000 });
        const p = res.data.pairs?.[0];
        if (p) {
            stats.mcap = p.fdv || p.marketCap || 0;
            stats.price = p.priceUsd || 0;
            stats.name = p.baseToken?.name || "Token";
            stats.sym = p.baseToken?.symbol || "???";
            stats.pooled = p.liquidity?.quote ? (p.liquidity.quote / 150).toFixed(1) : 0;
            stats.burned = (p.dexId === 'pump' || p.liquidity?.base === 0) ? "✅" : "❌";
            stats.priceChange = p.priceChange?.h24 || 0;
        }
    } catch(e) {
        console.log("DexScreener error:", e.message);
    }

    const arrow = stats.priceChange >= 0 ? '🟢' : '🔴';
    
    // Sanitize token name/symbol for Markdown
    const safeName = stats.name.replace(/[*_`\[\]]/g, '');
    const safeSym = stats.sym.replace(/[*_`\[\]]/g, '');
    
    const text = 
`💎 ${safeName} (${safeSym})
📍 \`${ca}\`

💰 *Price:* \`$${Number(stats.price).toFixed(8)}\` ${arrow} ${stats.priceChange.toFixed(1)}%
💡 *MCap:* \`$${Number(stats.mcap).toLocaleString()}\`
💧 *Pooled:* \`${stats.pooled} SOL\` | 🔥 *Burned:* ${stats.burned}

💳 *Wallet:* \`W${wallet.index}\`
💰 *SOL:* \`${(balance || 0).toFixed(4)}\` | 🪙 ${safeSym}: \`${(tokenBalance || 0).toFixed(2)}\`
⚙️ *Slip:* \`${userData.settings.slippage}%\` | *Fee:* \`${userData.settings.priorityFee} SOL\`

---
*Execute Actions:*`;

    const kb = {
        inline_keyboard: [
            [{ text: "🔄 Refresh", callback_data: `ref_${ca}` }, { text: "📈 Chart", url: `https://dexscreener.com/solana/${ca}` }, { text: "🔍 Solscan", url: `https://solscan.io/token/${ca}` }],
            [{ text: "🚀 Buy 0.2", callback_data: `buy_0.2_${ca}` }, { text: "🚀 Buy 0.5", callback_data: `buy_0.5_${ca}` }, { text: "🚀 Buy 1.0", callback_data: `buy_1.0_${ca}` }],
            [{ text: "🚀 Buy 2.0", callback_data: `buy_2.0_${ca}` }, { text: "🚀 Buy 5.0", callback_data: `buy_5.0_${ca}` }, { text: "🚀 Buy X", callback_data: `buy_x_${ca}` }],
            [{ text: "🔴 Sell 25%", callback_data: `sell_25_${ca}` }, { text: "🔴 Sell 50%", callback_data: `sell_50_${ca}` }, { text: "🔴 Sell 100%", callback_data: `sell_100_${ca}` }],
            [{ text: "🏠 Menu", callback_data: "menu_main" }]
        ]
    };

    await postToTG('sendMessage', { chat_id: chatId, text, parse_mode: 'Markdown', reply_markup: kb });
};

// === WALLET MENU ===
const sendWalletMenu = async (chatId, userId) => {
    const userData = getUserData(userId);
    
    let msg = `💳 *Wallet Manager*\n\n_Select a wallet to activate:*\n\n`;
    const kb = { inline_keyboard: [] };
    
    for (const w of userData.wallets) {
        const balance = await getBalance(w.publicKey);
        const mark = w.active ? '✅ ' : '     ';
        const shortKey = w.publicKey.slice(0,6) + '...' + w.publicKey.slice(-4);
        msg += `${mark}W${w.index}: \`${shortKey}\` | ${(balance || 0).toFixed(3)} SOL\n`;
        kb.inline_keyboard.push([
            { text: w.active ? `✅ W${w.index} Active` : `Select W${w.index}`, callback_data: `sel_w_${w.index}` },
            { text: `🔑 Export`, callback_data: `exp_w_${w.index}` }
        ]);
    }
    
    kb.inline_keyboard.push([{ text: "🏠 Menu", callback_data: "menu_main" }]);
    await postToTG('sendMessage', { chat_id: chatId, text: msg, parse_mode: "Markdown", reply_markup: kb });
};

// === SETTINGS MENU ===
const sendSettingsMenu = async (chatId, userId) => {
    const userData = getUserData(userId);
    
    const text = 
`⚙️ *Trading Settings*

📊 *Slippage:* \`${userData.settings.slippage}%\`
💸 *Priority Fee:* \`${userData.settings.priorityFee} SOL\`

_Select slippage tolerance:`;

    const kb = {
        inline_keyboard: [
            [{ text: userData.settings.slippage === 5 ? "✅ 5%" : "5%", callback_data: "set_slip_5" }, 
             { text: userData.settings.slippage === 10 ? "✅ 10%" : "10%", callback_data: "set_slip_10" }, 
             { text: userData.settings.slippage === 15 ? "✅ 15%" : "15%", callback_data: "set_slip_15" }],
            [{ text: userData.settings.slippage === 20 ? "✅ 20%" : "20%", callback_data: "set_slip_20" }, 
             { text: userData.settings.slippage === 25 ? "✅ 25%" : "25%", callback_data: "set_slip_25" }, 
             { text: userData.settings.slippage === 30 ? "✅ 30%" : "30%", callback_data: "set_slip_30" }],
            [{ text: "💸 Fee: 0.001", callback_data: "set_fee_0.001" }, 
             { text: "💸 Fee: 0.005", callback_data: "set_fee_0.005" }, 
             { text: "💸 Fee: 0.01", callback_data: "set_fee_0.01" }],
            [{ text: "🏠 Menu", callback_data: "menu_main" }]
        ]
    };
    await postToTG('sendMessage', { chat_id: chatId, text, parse_mode: 'Markdown', reply_markup: kb });
};

// === REFERRAL MENU ===
const sendReferralMenu = async (chatId, userId) => {
    const userData = getUserData(userId);
    const refLink = `https://t.me/MiintRadarBot?start=ref_${userData.referralId}`;
    
    const text = 
`🎁 *Referral Program*

Share your link and earn **30% of trading fees**!

👥 *Your Link:*
\`${refLink}\`

💰 *Your Earnings:* \`${(userData.totalBonus || 0).toFixed(4)} SOL\`
📊 *Referral Trades:* Coming soon`;

    const kb = {
        inline_keyboard: [
            [{ text: "📣 Share Link", url: `https://t.me/share/url?url=${encodeURIComponent(refLink)}&text=${encodeURIComponent('🦀 Trade Solana memecoins with MiintRadar - the fastest terminal!')}` }],
            [{ text: "🏠 Menu", callback_data: "menu_main" }]
        ]
    };
    await postToTG('sendMessage', { chat_id: chatId, text, parse_mode: 'Markdown', reply_markup: kb });
};

// === POSITIONS MENU ===
const sendPositionsMenu = async (chatId, userId) => {
    const userData = getUserData(userId);
    const wallet = userData.wallets.find(w => w.active) || userData.wallets[0];
    const balance = await getBalance(wallet.publicKey);
    
    let msg = `📊 *Your Positions*\n\n💳 *Wallet:* W${wallet.index}\n💰 *SOL:* \`${(balance || 0).toFixed(4)}\`\n\n`;
    
    // Get token accounts
    try {
        const tokens = await connection.getParsedTokenAccountsByOwner(
            new PublicKey(wallet.publicKey),
            { programId: new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA") }
        );
        
        if (tokens.value.length > 0) {
            for (const acc of tokens.value.slice(0, 10)) {
                const info = acc.account.data.parsed.info;
                const mint = info.mint;
                const amount = info.tokenAmount.uiAmount;
                if (amount > 0) {
                    msg += `🪙 \`${mint.slice(0,8)}...\` | ${amount.toFixed(2)} tokens\n`;
                }
            }
        } else {
            msg += `_No token positions found_\n`;
        }
    } catch(e) {
        msg += `_Could not load positions_\n`;
    }
    
    const kb = {
        inline_keyboard: [
            [{ text: "🔄 Refresh", callback_data: "menu_positions" }],
            [{ text: "🏠 Menu", callback_data: "menu_main" }]
        ]
    };
    await postToTG('sendMessage', { chat_id: chatId, text: msg, parse_mode: 'Markdown', reply_markup: kb });
};

// === TRENDING MENU ===
const sendTrendingMenu = async (chatId, userId) => {
    let msg = `📈 *Trending Tokens*\n\n`;
    
    try {
        const res = await axios.get("https://api.dexscreener.com/token-boosts/top/v1", { timeout: 10000 });
        const tokens = res.data?.slice(0, 5) || [];
        
        tokens.forEach((t, i) => {
            msg += `${i + 1}. *${t.name || 'Unknown'}* ($${t.symbol || '???'})\n`;
            msg += `   💰 $${Number(t.priceUsd || 0).toFixed(8)}\n`;
            msg += `   📍 \`${t.address}\`\n\n`;
        });
    } catch(e) {
        msg += `_Could not load trending tokens_`;
    }
    
    const kb = {
        inline_keyboard: [[{ text: "🏠 Menu", callback_data: "menu_main" }]]
    };
    await postToTG('sendMessage', { chat_id: chatId, text: msg, parse_mode: 'Markdown', reply_markup: kb });
};

// === HELP MENU ===
const sendHelpMenu = async (chatId, userId) => {
    const text = 
`💡 *MiintRadar Help*

*Commands:*
/start - Open main menu
/menu - Main menu
/wallets - Manage wallets
/settings - Trading settings
/ref - Referral program
/positions - Your holdings
/trending - Hot tokens

*How to Trade:*
1️⃣ Fund your wallet (SOL)
2️⃣ Paste a token CA
3️⃣ Click Buy button
4️⃣ Check Solscan link

*Features:*
• Real-time token data
• Jupiter swaps
• Auto slippage
• Position tracking

_Need help?_ @Dylancuzs`;

    const kb = {
        inline_keyboard: [[{ text: "🏠 Menu", callback_data: "menu_main" }]]
    };
    await postToTG('sendMessage', { chat_id: chatId, text, parse_mode: 'Markdown', reply_markup: kb });
};

// === TRANSACTION MESSAGE ===
const sendTxMessage = async (chatId, result, ca) => {
    if (!result.success) {
        let errorMsg = `❌ *Transaction Failed*\n\n`;
        
        if (result.error === "insufficient_balance") {
            errorMsg += `💸 *Insufficient Balance*\n\n`;
            errorMsg += `Required: \`${result.amount} SOL\`\n`;
            errorMsg += `Available: \`${(result.balance || 0).toFixed(4)} SOL\`\n\n`;
            errorMsg += `_Fund your wallet and try again_`;
        } else {
            errorMsg += `Error: \`${result.error || 'Unknown'}\`\n\n`;
            errorMsg += `_Please try again_`;
        }
        
        if (result.txid) {
            errorMsg += `\n[View Transaction](https://solscan.io/tx/${result.txid})`;
        }
        
        await postToTG('sendMessage', { chat_id: chatId, text: errorMsg, parse_mode: 'Markdown' });
        return;
    }
    
    const txLink = `https://solscan.io/tx/${result.txid}`;
    
    if (result.isBuy) {
        const text = 
`✅ *Buy Successful!*

💎 *Amount:* \`${result.amount} SOL\`
🪙 *Received:* \`${result.outputAmount?.toFixed(2) || '?'} tokens\`
💳 *New Balance:* \`${result.newBalance?.toFixed(4) || '?'} SOL\`

🔗 [View on Solscan](${txLink})
📍 Token: \`${ca}\``;
        await postToTG('sendMessage', { chat_id: chatId, text, parse_mode: 'Markdown', disable_web_page_preview: true });
    } else {
        const text = 
`✅ *Sell Successful!*

🪙 *Sold:* \`${result.amount}% of tokens\`
💰 *Received:* \`${result.outputAmount?.toFixed(4) || '?'} SOL\`
💳 *New Balance:* \`${result.newBalance?.toFixed(4) || '?'} SOL\`

🔗 [View on Solscan](${txLink})
📍 Token: \`${ca}\``;
        await postToTG('sendMessage', { chat_id: chatId, text, parse_mode: 'Markdown', disable_web_page_preview: true });
    }
};

// === TELEGRAM API ===
async function postToTG(method, data) {
    try { 
        await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/${method}`, data); 
    } catch (e) {
        console.log("TG Error:", e.response?.data || e.message);
    }
}

// === MAIN POLL LOOP ===
const poll = async () => {
    let offset = 0;
    console.log("✅ MiintRadar Terminal v3.0 ACTIVE");
    
    while (true) {
        try {
            const res = await axios.get(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/getUpdates?offset=${offset}&timeout=30`);
            for (const upd of res.data.result) {
                offset = upd.update_id + 1;
                const cid = upd.message?.chat.id || upd.callback_query?.message.chat.id;
                const uid = upd.message?.from.id || upd.callback_query?.from.id;
                if (!cid) continue;

                // === TEXT MESSAGES ===
                if (upd.message?.text) {
                    const txt = upd.message.text.trim();
                    
                    if (txt === '/start' || txt === '/menu') await sendMainMenu(cid, uid);
                    else if (txt === '/wallets') await sendWalletMenu(cid, uid);
                    else if (txt === '/settings') await sendSettingsMenu(cid, uid);
                    else if (txt === '/ref') await sendReferralMenu(cid, uid);
                    else if (txt === '/positions') await sendPositionsMenu(cid, uid);
                    else if (txt === '/trending') await sendTrendingMenu(cid, uid);
                    else if (txt === '/help') await sendHelpMenu(cid, uid);
                    else if (txt.length >= 32 && txt.length <= 44) await sendDashboard(cid, uid, txt);
                }
                // === CALLBACK BUTTONS ===
                else if (upd.callback_query) {
                    const data = upd.callback_query.data;
                    
                    // Menu Navigation
                    if (data === 'menu_main') await sendMainMenu(cid, uid);
                    else if (data === 'menu_wallets') await sendWalletMenu(cid, uid);
                    else if (data === 'menu_settings') await sendSettingsMenu(cid, uid);
                    else if (data === 'menu_ref') await sendReferralMenu(cid, uid);
                    else if (data === 'menu_positions') await sendPositionsMenu(cid, uid);
                    else if (data === 'menu_trending') await sendTrendingMenu(cid, uid);
                    else if (data === 'menu_help') await sendHelpMenu(cid, uid);
                    
                    // Refresh Dashboard
                    else if (data.startsWith('ref_')) {
                        const ca = data.split('_')[1];
                        await sendDashboard(cid, uid, ca);
                    }
                    
                    // Select Wallet
                    else if (data.startsWith('sel_w_')) {
                        const idx = parseInt(data.split('_')[2]);
                        const userData = getUserData(uid);
                        userData.wallets.forEach(w => w.active = (w.index === idx));
                        saveUserData(uid, userData);
                        await postToTG('answerCallbackQuery', { callback_query_id: upd.callback_query.id, text: `✅ Wallet ${idx} selected` });
                        await sendWalletMenu(cid, uid);
                    }
                    
                    // Export Wallet
                    else if (data.startsWith('exp_w_')) {
                        const idx = parseInt(data.split('_')[2]);
                        const userData = getUserData(uid);
                        const wallet = userData.wallets.find(w => w.index === idx);
                        await postToTG('sendMessage', { 
                            chat_id: cid, 
                            text: `🔑 *Wallet ${idx} Private Key*\n\n\`${wallet.secretKey}\`\n\n⚠️ Keep this safe! Import into Phantom/Solflare.`,
                            parse_mode: 'Markdown'
                        });
                    }
                    
                    // Settings: Slippage
                    else if (data.startsWith('set_slip_')) {
                        const val = parseInt(data.split('_')[2]);
                        const userData = getUserData(uid);
                        userData.settings.slippage = val;
                        saveUserData(uid, userData);
                        await postToTG('answerCallbackQuery', { callback_query_id: upd.callback_query.id, text: `✅ Slippage: ${val}%` });
                        await sendSettingsMenu(cid, uid);
                    }
                    
                    // Settings: Priority Fee
                    else if (data.startsWith('set_fee_')) {
                        const val = parseFloat(data.split('_')[2]);
                        const userData = getUserData(uid);
                        userData.settings.priorityFee = val;
                        saveUserData(uid, userData);
                        await postToTG('answerCallbackQuery', { callback_query_id: upd.callback_query.id, text: `✅ Fee: ${val} SOL` });
                        await sendSettingsMenu(cid, uid);
                    }
                    
                    // Buy Buttons - EXECUTE REAL SWAP
                    else if (data.startsWith('buy_')) {
                        const parts = data.split('_');
                        const amount = parseFloat(parts[1]);
                        const ca = parts.slice(2).join('_');
                        
                        await postToTG('answerCallbackQuery', { callback_query_id: upd.callback_query.id, text: `🔄 Processing buy...` });
                        await postToTG('sendMessage', { chat_id: cid, text: `⏳ *Executing Buy Order*\n\n💎 \`${amount} SOL\`\n📍 \`${ca}\`\n\n_Connecting to Jupiter..._`, parse_mode: 'Markdown' });
                        
                        const result = await executeSwap(uid, ca, amount, true);
                        await sendTxMessage(cid, result, ca);
                    }
                    
                    // Sell Buttons - EXECUTE REAL SWAP
                    else if (data.startsWith('sell_')) {
                        const parts = data.split('_');
                        const pct = parseInt(parts[1]);
                        const ca = parts.slice(2).join('_');
                        
                        // Get token balance first
                        const userData = getUserData(uid);
                        const wallet = userData.wallets.find(w => w.active);
                        const tokenBalance = await getTokenBalance(wallet.publicKey, ca);
                        
                        if (tokenBalance <= 0) {
                            await postToTG('answerCallbackQuery', { callback_query_id: upd.callback_query.id, text: `❌ No tokens to sell` });
                            await postToTG('sendMessage', { chat_id: cid, text: `❌ *No Token Balance*\n\nYou don't hold any of this token in your wallet.`, parse_mode: 'Markdown' });
                        } else {
                            await postToTG('answerCallbackQuery', { callback_query_id: upd.callback_query.id, text: `🔄 Processing sell...` });
                            await postToTG('sendMessage', { chat_id: cid, text: `⏳ *Executing Sell Order*\n\n🔴 \`${pct}%\` of ${tokenBalance.toFixed(2)} tokens\n📍 \`${ca}\`\n\n_Connecting to Jupiter..._`, parse_mode: 'Markdown' });
                            
                            const sellAmount = tokenBalance * (pct / 100);
                            const result = await executeSwap(uid, ca, sellAmount, false);
                            await sendTxMessage(cid, result, ca);
                        }
                    }
                    
                    await postToTG('answerCallbackQuery', { callback_query_id: upd.callback_query.id });
                }
            }
        } catch (e) { 
            console.log("Poll error:", e.message);
            // Exponential backoff for network errors
            const delay = e.code === 'ECONNRESET' ? 5000 : 2000;
            await new Promise(r => setTimeout(r, delay)); 
        }
    }
};

poll();
