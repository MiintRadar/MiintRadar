import { useState, useMemo } from 'react'
import { Token } from '../lib/tokens'

interface TokenSelectorProps {
  tokens: Token[]
  onSelect: (token: Token) => void
  onClose: () => void
  exclude?: string
}

export default function TokenSelector({ tokens, onSelect, onClose, exclude }: TokenSelectorProps) {
  const [search, setSearch] = useState('')

  const filteredTokens = useMemo(() => {
    const list = tokens.filter(t => t.address !== exclude)
    if (!search) return list.slice(0, 50)
    
    const searchLower = search.toLowerCase()
    return list.filter(t => 
      t.symbol.toLowerCase().includes(searchLower) ||
      t.name.toLowerCase().includes(searchLower) ||
      t.address.toLowerCase().includes(searchLower)
    ).slice(0, 50)
  }, [tokens, search, exclude])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="glass rounded-2xl w-full max-w-md max-h-[80vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-[#2a2a3a] flex justify-between items-center">
          <h2 className="text-lg font-semibold">Select Token</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Search */}
        <div className="p-4">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or address"
            className="w-full bg-[#0a0a0f] border border-[#2a2a3a] rounded-xl px-4 py-3 outline-none focus:border-[#00d4aa] transition-colors"
          />
        </div>

        {/* Token List */}
        <div className="flex-1 overflow-y-auto">
          {filteredTokens.length === 0 ? (
            <div className="p-8 text-center text-gray-400">
              No tokens found
            </div>
          ) : (
            filteredTokens.map((token) => (
              <button
                key={token.address}
                onClick={() => onSelect(token)}
                className="w-full p-4 flex items-center gap-4 hover:bg-[#1a1a25] transition-colors"
              >
                {token.logoURI ? (
                  <img
                    src={token.logoURI}
                    alt={token.symbol}
                    className="w-10 h-10 rounded-full"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none'
                    }}
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#00d4aa] to-[#7c3aed] flex items-center justify-center font-bold">
                    {token.symbol.charAt(0)}
                  </div>
                )}
                <div className="flex-1 text-left">
                  <div className="font-semibold">{token.symbol}</div>
                  <div className="text-sm text-gray-400">{token.name}</div>
                </div>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
