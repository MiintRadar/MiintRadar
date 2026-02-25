import { useWallet, useConnection } from '@solana/wallet-adapter-react'
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui'
import { useState, useEffect, useCallback } from 'react'
import SwapCard from '../components/SwapCard'

export default function Home() {
  const { connected, publicKey } = useWallet()
  const { connection } = useConnection()
  const [balance, setBalance] = useState<number>(0)

  useEffect(() => {
    if (publicKey) {
      connection.getBalance(publicKey).then(b => setBalance(b / 1e9))
    }
  }, [publicKey, connection])

  return (
    <div className="min-h-screen bg-[#0a0a0f] relative overflow-hidden">
      {/* Animated background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-1/2 -left-1/2 w-full h-full bg-gradient-to-br from-[#00d4aa]/10 to-transparent rounded-full blur-3xl" />
        <div className="absolute -bottom-1/2 -right-1/2 w-full h-full bg-gradient-to-tl from-[#7c3aed]/10 to-transparent rounded-full blur-3xl" />
      </div>

      {/* Header */}
      <header className="relative z-10 p-6">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#00d4aa] to-[#7c3aed] flex items-center justify-center text-xl font-bold">
              M
            </div>
            <span className="text-xl font-bold gradient-text">MiintSwap</span>
          </div>
          
          <div className="flex items-center gap-4">
            {connected && publicKey && (
              <div className="hidden sm:block text-sm text-gray-400">
                {balance.toFixed(4)} SOL
              </div>
            )}
            <WalletMultiButton className="!bg-gradient-to-r !from-[#00d4aa] !to-[#7c3aed] !rounded-xl !py-2 !px-4 !text-white !font-semibold !border-none hover:!opacity-90 transition-opacity" />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="relative z-10 flex flex-col items-center justify-center min-h-[calc(100vh-100px)] px-4">
        <div className="w-full max-w-lg">
          {/* Title */}
          <div className="text-center mb-8">
            <h1 className="text-4xl sm:text-5xl font-bold mb-3">
              <span className="gradient-text">Swap</span> instantly
            </h1>
            <p className="text-gray-400">
              Fast, secure token swaps on Solana
            </p>
          </div>

          {/* Swap Card */}
          <SwapCard />

          {/* Footer info */}
          <div className="mt-6 text-center text-sm text-gray-500">
            Powered by Jupiter • Best prices guaranteed
          </div>
        </div>
      </main>
    </div>
  )
}
