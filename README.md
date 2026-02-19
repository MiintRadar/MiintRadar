# MiintRadar Terminal 🦀

**Professional Solana Trading Terminal for Degens**

The fastest, most transparent way to trade Solana memecoins via Telegram.

## ✨ Features

### 🔄 Real Trading
- **Jupiter Integration** - Real on-chain swaps
- **One-Click Buy** - 0.2, 0.5, 1.0, 2.0, 5.0, X SOL buttons
- **One-Click Sell** - 25%, 50%, 100% buttons
- **Auto Slippage** - Configurable 5-30%

### 💳 Multi-Wallet System
- **5 Wallets per User** - Auto-generated keypairs
- **Private Key Export** - Import to Phantom/Solflare
- **Balance Tracking** - Real-time SOL & token balances

### 📊 Market Data
- **DexScreener API** - Price, MCap, Liquidity
- **Burn Status** - Check if LP is burned
- **Price Change** - 24h indicators (🟢/🔴)
- **Trending Tokens** - Top boosted tokens

### 💰 Monetization
- **Referral System** - 30% fee share
- **Revenue Wallet** - Auto fee collection

### 🛡️ Security
- **Non-Custodial** - Keys stored locally
- **Open Source** - Fully auditable code
- **No Private Data in Repo** - .gitignore protected

## 🚀 Quick Start

```bash
# Clone the repo
git clone https://github.com/MiintRadar/MiintRadar.git
cd MiintRadar

# Install dependencies
npm install

# Run the bot
node index.js
```

## 📱 Commands

| Command | Description |
|---------|-------------|
| `/start` | Open main menu |
| `/menu` | Main menu |
| `/wallets` | Manage wallets |
| `/settings` | Trading settings |
| `/ref` | Referral program |
| `/positions` | Your token holdings |
| `/trending` | Hot tokens |
| `/help` | Help info |

## 🔧 Configuration

Settings are stored per-user:
- **Slippage:** 5%, 10%, 15%, 20%, 25%, 30%
- **Priority Fee:** 0.001, 0.005, 0.01 SOL

## 🌐 Deployment

### Vercel (Web Terminal)
```bash
vercel --prod
```

### Server (24/7 Bot)
```bash
nohup node index.js > bot.log 2>&1 &
```

## 🔒 Security Notes

- **Never commit** `users_wallets.json` - Contains private keys
- **Never commit** `.env` files
- **Rotate tokens** if accidentally exposed
- Users should **backup** their private keys

## 📦 Dependencies

```json
{
  "axios": "^1.x",
  "@solana/web3.js": "^1.x",
  "bs58": "^5.x"
}
```

## 🤝 Contributing

Open to contributions! Please:
1. Fork the repo
2. Create a feature branch
3. Submit a pull request

## 📄 License

MIT License - Open Source

---

**Built with 🦀 by the MiintRadar Team**

[Try on Telegram](https://t.me/MiintRadarBot) | [View on DexScreener](https://dexscreener.com)
