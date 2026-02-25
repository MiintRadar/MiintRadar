// Jupiter API v6 Integration
// Docs: https://docs.jup.ag/api-v6

const JUPITER_API = 'https://quote-api.jup.ag/v6'

export interface QuoteResponse {
  inputMint: string
  inAmount: string
  outputMint: string
  outAmount: string
  otherAmountThreshold: string
  swapMode: string
  slippageBps: number
  priceImpactPct: string
  routePlan: Array<{
    swapInfo: {
      ammKey: string
      label: string
      inputMint: string
      outputMint: string
      inAmount: string
      outAmount: string
      feeAmount: string
      feeMint: string
    }
    percent: number
  }>
  contextSlot: number
  timeTaken: number
}

export interface SwapResponse {
  swapTransaction: string
  lastValidBlockHeight: number
  lastValidBlockHeightBackup: number
  cleanupSerializedTransaction: boolean
}

/**
 * Get a quote for a swap
 */
export async function getQuote(
  inputMint: string,
  outputMint: string,
  amount: string,
  slippageBps: number = 50
): Promise<QuoteResponse | null> {
  try {
    const params = new URLSearchParams({
      inputMint,
      outputMint,
      amount,
      slippageBps: slippageBps.toString(),
    })
    
    const response = await fetch(`${JUPITER_API}/quote?${params}`)
    
    if (!response.ok) {
      throw new Error(`Quote failed: ${response.statusText}`)
    }
    
    return await response.json()
  } catch (error) {
    console.error('Quote error:', error)
    return null
  }
}

/**
 * Get swap transaction for signing
 */
export async function getSwapTransaction(
  quoteResponse: QuoteResponse,
  userPublicKey: string
): Promise<SwapResponse | null> {
  try {
    const response = await fetch(`${JUPITER_API}/swap`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        quoteResponse,
        userPublicKey,
        wrapAndUnwrapSol: true,
        dynamicComputeUnitLimit: true,
        prioritizationFeeLamports: 'auto',
      }),
    })
    
    if (!response.ok) {
      throw new Error(`Swap failed: ${response.statusText}`)
    }
    
    return await response.json()
  } catch (error) {
    console.error('Swap error:', error)
    return null
  }
}

/**
 * Get price for a token pair (uses small amount to calculate ratio)
 */
export async function getPrice(
  inputMint: string,
  outputMint: string,
  inputDecimals: number = 9
): Promise<number | null> {
  try {
    // Use a small amount (0.001 of input token)
    const amount = Math.pow(10, inputDecimals - 3).toString()
    
    const quote = await getQuote(inputMint, outputMint, amount, 50)
    
    if (!quote) return null
    
    // Calculate price ratio
    const outAmount = Number(quote.outAmount)
    return outAmount / Number(amount)
  } catch (error) {
    console.error('Price error:', error)
    return null
  }
}