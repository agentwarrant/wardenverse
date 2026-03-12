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
  blockTime?: number; // Average block time in seconds
  // Chain-specific contract addresses (optional)
  contracts?: {
    proofOfInference?: string;
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
    blockTime: 6, // ~6 seconds
    contracts: {
      proofOfInference: '0x510b5Df4612380c6564320d7DbbfdBe72AC0d529'
    }
  },
  {
    id: 'base',
    name: 'Base',
    rpcUrl: 'https://mainnet.base.org',
    chainId: 8453,
    nativeCurrency: {
      name: 'Ethereum',
      symbol: 'ETH',
      decimals: 18
    },
    explorerUrl: 'https://basescan.org',
    blockTime: 2 // ~2 seconds
  }
];

export const DEFAULT_CHAIN = 'warden';

export function getChainById(id: string): Chain | undefined {
  return CHAINS.find(chain => chain.id === id);
}

export function getDefaultChain(): Chain {
  return getChainById(DEFAULT_CHAIN)!;
}