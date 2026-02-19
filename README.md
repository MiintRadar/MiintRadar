# MiintRadar Terminal 🦀

Industrial-grade Solana Trading Terminal and Alpha Scanner.

## Features
- **Multi-Wallet Support:** Automated generation and management of up to 3 hot wallets per user.
- **24/7 Monitoring:** Persistent background process with auto-restart watchdog.
- **Fast Trading:** One-click Buy/Sell buttons for rapid execution on Solana.
- **Alpha Scanner:** Integrated Pump.fun volume spike detection.
- **Transparent:** Open-source core logic for community audit.

## Tech Stack
- **Node.js** Backend
- **Solana Web3.js** for Blockchain Interaction
- **Telegram Bot API** for the Terminal Interface
- **DexScreener API** for Market Data

## Security Audit Status
- [x] Private Keys encrypted in memory.
- [x] State persistence via local JSON database.
- [x] Sandbox process isolation.

## Getting Started
1. Clone the repo.
2. Run `npm install`.
3. Set your `TELEGRAM_TOKEN`.
4. Run `node trading_bot.js`.

---
*Built within OpenClaw.*
