import { useWallet, useConnection } from '@solana/wallet-adapter-react'
import { PublicKey, Transaction, VersionedTransaction } from '@solana/web3.js'
import { useState, useEffect, useCallback, useMemo } from 'react'
import TokenSelector from './TokenSelector'
import { getQuote, getSwapTransaction, QuoteResponse } from '../lib/jupiter'
import { Token, SOL_MINT, POPULAR_TOKENS, getTokenList } from '../lib/tokens'

export default function SwapCard() {
  const { connected, publicKey, signTransaction, signAllTransactions } = useWallet()
  const { connection } = useConnection()

  // Token state
  const [tokens, setTokens] = useState<Token[]>(POPULAR_TOKENS)
  const [fromToken, setFromToken] = useState<Token>(POPULAR_TOKENS[0]) // SOL
  const [toToken, setToToken] = useState<Token>(POPULAR_TOKENS[1]) // USDC
  const [fromAmount, setFromAmount] = useState<string>('')
  const [toAmount, setToAmount] = useState<string>('0')

  // UI state
  const [loading, setLoading] = useState(false)
  const [swapping, setSwapping] = useState(false)
  const [showFromSelector, setShowFromSelector] = useState(false)
  const [showToSelector, setShowToSelector] = useState(false)
  const [slippage, setSlippage] = useState(0.5)
  const [quote, setQuote] = useState<QuoteResponse | null>(null)

  // Load token list
  useEffect(() => {
    getTokenList().then(setTokens)
  }, [])

  // Get quote when inputs change
  useEffect(() => {
    if (!fromAmount || parseFloat(fromAmount) <= 0) {
      setToAmount('0')
      setQuote(null)
      return
    }

    const getQuoteAsync = async () => {
      setLoading(true)
      try {
        const amountInLamports = Math.floor(parseFloat(fromAmount) * Math.pow(10, fromToken.decimals))
        const quoteResult = await getQuote(
          fromToken.address,
          toToken.address,
          amountInLamports.toString(),
          slippage * 100
        )
        
        if (quoteResult) {
          setQuote(quoteResult)
          const outAmount = parseFloat(quoteResult.outAmount) / Math.pow(10, toToken.decimals)
          setToAmount(outAmount.toFixed(toToken.decimals > 6 ? 6 : toToken.decimals))
        }
      } catch (e) {
        console.error('Quote error:', e)
        setToAmount('0')
      }
      setLoading(false)
    }

    const timeoutId = setTimeout(getQuoteAsync, 500)
    return () => clearTimeout(timeoutId)
  }, [fromAmount, fromToken, toToken, slippage])

  // Swap tokens
  const handleSwap = useCallback(async () => {
    if (!connected || !publicKey || !quote || !signTransaction) {
      return
    }

    setSwapping(true)
    try {
      const swapResult = await getSwapTransaction(quote, publicKey.toString())
      
      if (!swapResult) {
        throw new Error('Failed to get swap transaction')
      }

      // Deserialize the transaction
      const swapTransactionBuf = Buffer.from(swapResult.swapTransaction, 'base64')
      const transaction = VersionedTransaction.deserialize(swapTransactionBuf)

      // Sign the transaction
      const signedTransaction = await signTransaction(transaction)

      // Send the transaction
      const rawTransaction = signedTransaction.serialize()
      const txid = await connection.sendRawTransaction(rawTransaction, {
        skipPreflight: true,
        maxRetries: 2,
      })

      // Confirm the transaction
      const latestBlockHash = await connection.getLatestBlockhash()
      await connection.confirmTransaction({
        blockhash: latestBlockHash.blockhash,
        lastValidBlockHeight: latestBlockHash.lastValidBlockHeight,
        signature: txid,
      }, 'confirmed')

      // Success!
      setFromAmount('')
      setToAmount('0')
      setQuote(null)
      
      // Show success message
      alert(`Swap successful! Transaction: ${txid}`)
    } catch (e: any) {
      console.error('Swap error:', e)
      alert(`Swap failed: ${e.message || 'Unknown error'}`)
    }
    setSwapping(false)
  }, [connected, publicKey, quote, signTransaction, connection])

  // Switch tokens
  const handleSwitch = useCallback(() => {
    const temp = fromToken
    setFromToken(toToken)
    setToToken(temp)
    setFromAmount(toAmount)
  }, [fromToken, toToken, toAmount])

  return (
    <>
      <div className="glass rounded-2xl p-6 glow">
        {/* From Token */}
        <div className="mb-2">
          <div className="flex justify-between text-sm text-gray-400 mb-2">
            <span>You pay</span>
            {connected && fromToken.address === SOL_MINT && (
              <span>Balance: available</span>
            )}
          </div>
          <div className="bg-[#0a0a0f] rounded-xl p-4 flex gap-4">
            <input
              type="number"
              value={fromAmount}
              onChange={(e) => setFromAmount(e.target.value)}
              placeholder="0.00"
              className="flex-1 bg-transparent text-3xl font-semibold outline-none placeholder-gray-600"
            />
            <button
              onClick={() => setShowFromSelector(true)}
              className="flex items-center gap-2 bg-[#1a1a25] hover:bg-[#252535] px-4 py-2 rounded-xl transition-colors"
            >
              {fromToken.logoURI && (
                <img src={fromToken.logoURI} alt={fromToken.symbol} className="w-6 h-6 rounded-full" />
              )}
              <span className="font-semibold">{fromToken.symbol}</span>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          </div>
        </div>

        {/* Switch Button */}
        <div className="relative h-0 flex justify-center">
          <button
            onClick={handleSwitch}
            className="absolute z-10 -translate-y-1/2 bg-[#1a1a25] hover:bg-[#252535] p-2 rounded-xl border-4 border-[#0a0a0f] transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
            </svg>
          </button>
        </div>

        {/* To Token */}
        <div className="mt-2">
          <div className="flex justify-between text-sm text-gray-400 mb-2">
            <span>You receive</span>
            {loading && <span className="text-[#00d4aa]">Fetching best price...</span>}
          </div>
          <div className="bg-[#0a0a0f] rounded-xl p-4 flex gap-4">
            <input
              type="text"
              value={toAmount}
              readOnly
              placeholder="0.00"
              className="flex-1 bg-transparent text-3xl font-semibold outline-none placeholder-gray-600"
            />
            <button
              onClick={() => setShowToSelector(true)}
              className="flex items-center gap-2 bg-[#1a1a25] hover:bg-[#252535] px-4 py-2 rounded-xl transition-colors"
            >
              {toToken.logoURI && (
                <img src={toToken.logoURI} alt={toToken.symbol} className="w-6 h-6 rounded-full" />
              )}
              <span className="font-semibold">{toToken.symbol}</span>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          </div>
        </div>

        {/* Price Impact & Info */}
        {quote && (
          <div className="mt-4 text-sm text-gray-400 space-y-1">
            <div className="flex justify-between">
              <span>Price Impact</span>
              <span className={parseFloat(quote.priceImpactPct) > 1 ? 'text-red-400' : 'text-green-400'}>
                {parseFloat(quote.priceImpactPct).toFixed(2)}%
              </span>
            </div>
            <div className="flex justify-between">
              <span>Slippage Tolerance</span>
              <span>{slippage}%</span>
            </div>
          </div>
        )}

        {/* Swap Button */}
        {!connected ? (
          <button
            disabled
            className="w-full mt-4 py-4 rounded-xl bg-gray-700 text-gray-400 font-semibold"
          >
            Connect wallet to swap
          </button>
        ) : !fromAmount || parseFloat(fromAmount) <= 0 ? (
          <button
            disabled
            className="w-full mt-4 py-4 rounded-xl bg-gray-700 text-gray-400 font-semibold"
          >
            Enter an amount
          </button>
        ) : (
          <button
            onClick={handleSwap}
            disabled={swapping || loading || !quote}
            className="btn-primary w-full mt-4 py-4 text-lg"
          >
            {swapping ? 'Swapping...' : loading ? 'Loading...' : 'Swap'}
          </button>
        )}
      </div>

      {/* Token Selector Modal - From */}
      {showFromSelector && (
        <TokenSelector
          tokens={tokens}
          onSelect={(token) => {
            setFromToken(token)
            setShowFromSelector(false)
          }}
          onClose={() => setShowFromSelector(false)}
          exclude={toToken.address}
        />
      )}

      {/* Token Selector Modal - To */}
      {showToSelector && (
        <TokenSelector
          tokens={tokens}
          onSelect={(token) => {
            setToToken(token)
            setShowToSelector(false)
          }}
          onClose={() => setShowToSelector(false)}
          exclude={fromToken.address}
        />
      )}
    </>
  )
}
