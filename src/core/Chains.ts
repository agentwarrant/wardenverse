/**
 * Blockchain chain configuration for Wardenverse
 * Supports multiple EVM-compatible chains
 */

export interface Chain {
  id: string;
  name: string;
  rpcUrl: string;
  chainId?: number;
  nativeCurrency: {
    name: string;
    symbol: string;
    decimals: number;
  };
  explorerUrl?: string;
  statsApiUrl?: string; // URL to fetch chain stats (total transactions, etc.)
  blockTime?: number; // Average block time in seconds
  // Chain-specific contract addresses (optional)
  contracts?: {
    proofOfInference?: string;
  };
  // Block colors for this chain
  colors: {
    primary: [number, number, number];
    secondary: [number, number, number];
    glow: [number, number, number];
  };
}

export const CHAINS: Chain[] = [
  {
    id: 'warden',
    name: 'Warden',
    rpcUrl: 'https://evm.wardenprotocol.org',
    nativeCurrency: {
      name: 'WARD',
      symbol: 'WARD',
      decimals: 18
    },
    explorerUrl: 'https://explorer.wardenprotocol.org',
    statsApiUrl: 'https://explorer.wardenprotocol.org/api/v1',
    blockTime: 6, // ~6 seconds
    contracts: {
      proofOfInference: '0x510b5Df4612380c6564320d7DbbfdBe72AC0d529'
    },
    colors: {
      primary: [251, 191, 36], // Yellow/gold for Warden
      secondary: [245, 158, 11],
      glow: [251, 191, 36]
    }
  }
  // Note: Base removed - transaction volume too different for current visualization
  // To re-add, include colors property with blue theme
];

export const DEFAULT_CHAIN = 'warden';

export function getChainById(id: string): Chain | undefined {
  return CHAINS.find(chain => chain.id === id);
}

export function getDefaultChain(): Chain {
  return getChainById(DEFAULT_CHAIN)!;
}