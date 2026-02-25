export interface Token {
  address: string
  chainId: number
  decimals: number
  name: string
  symbol: string
  logoURI?: string
  tags?: string[]
}

export const SOL_MINT = 'So11111111111111111111111111111111111111112'
export const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'

// Popular tokens list
export const POPULAR_TOKENS: Token[] = [
  {
    address: SOL_MINT,
    chainId: 101,
    decimals: 9,
    name: 'Wrapped SOL',
    symbol: 'SOL',
    logoURI: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png',
  },
  {
    address: USDC_MINT,
    chainId: 101,
    decimals: 6,
    name: 'USD Coin',
    symbol: 'USDC',
    logoURI: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v/logo.svg',
  },
  {
    address: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
    chainId: 101,
    decimals: 6,
    name: 'Tether USD',
    symbol: 'USDT',
    logoURI: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB/logo.svg',
  },
  {
    address: 'mSoLzYCxHdYgdzU16g5QSh3i5k3G3RhQvhDVMC7oLXR',
    chainId: 101,
    decimals: 9,
    name: 'Marinade staked SOL',
    symbol: 'mSOL',
    logoURI: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/mSoLzYCxHdYgdzU16g5QSh3i5k3G3RhQvhDVMC7oLXR/logo.png',
  },
  {
    address: 'J1toso1QPkeorAx9yJd5gNVmEVnCqDYqFuVh7BDAL8A',
    chainId: 101,
    decimals: 9,
    name: 'Jito SOL',
    symbol: 'JitoSOL',
    logoURI: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/J1toso1QPkeorAx9yJd5gNVmEVnCqDYqFuVh7BDAL8A/logo.png',
  },
  {
    address: '7dHbWXmci3dT8UFYWYZweBLXgycX7tXLtC5xPNyeCmJh',
    chainId: 101,
    decimals: 6,
    name: 'Jupiter Perps LP',
    symbol: 'JLP',
    logoURI: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/7dHbWXmci3dT8UFYWYZweBLXgycX7tXLtC5xPNyeCmJh/logo.png',
  },
  {
    address: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263',
    chainId: 101,
    decimals: 5,
    name: 'Bonk',
    symbol: 'BONK',
    logoURI: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263/logo.png',
  },
  {
    address: 'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN',
    chainId: 101,
    decimals: 6,
    name: 'Jupiter',
    symbol: 'JUP',
    logoURI: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN/logo.png',
  },
  {
    address: 'bSo13r4TkiE4KumL71LsHTPpL2euBYLFx6h3HP3piPk',
    chainId: 101,
    decimals: 9,
    name: 'BlazeStake Staked SOL',
    symbol: 'bSOL',
    logoURI: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/bSo13r4TkiE4KumL71LsHTPpL2euBYLFx6h3HP3piPk/logo.png',
  },
  {
    address: 'MEME99hVQr5Z5vJUMF4CLfsq5qoXq43PVQqGJqL8vKJ',
    chainId: 101,
    decimals: 6,
    name: 'MEME',
    symbol: 'MEME',
  },
]

let tokenListCache: Token[] | null = null

export async function getTokenList(): Promise<Token[]> {
  if (tokenListCache) return tokenListCache

  try {
    const response = await fetch('https://token.jup.ag/strict')
    const tokens = await response.json()
    tokenListCache = tokens
    return tokens
  } catch (error) {
    console.error('Failed to fetch token list:', error)
    return POPULAR_TOKENS
  }
}

export function findToken(address: string, tokens: Token[]): Token | undefined {
  return tokens.find(t => t.address === address)
}
