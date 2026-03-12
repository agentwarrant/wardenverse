/**
 * Blockchain Data Source - Connects to EVM-compatible chains
 * Fetches blocks and transactions for visualization
 * Supports chain switching between Warden, Base, and other EVM chains
 */

import { JsonRpcProvider, Block as EthersBlock, TransactionResponse } from 'ethers';
import { Chain, CHAINS, DEFAULT_CHAIN, getChainById } from '../core/Chains';

export interface Block {
  number: number;
  hash: string;
  timestamp: number;
  transactions: string[];
  gasUsed: string;
  gasLimit: string;
  parentHash: string;
}

export type TransactionType = 'transfer' | 'contract' | 'token' | 'inference';

export interface Transaction {
  hash: string;
  blockNumber: number;
  from: string;
  to: string | null;
  value: string;
  gasPrice: string;
  type: TransactionType;
}

type BlockCallback = (block: Block) => void;
type TransactionCallback = (tx: Transaction) => void;
type ChainChangeCallback = (chain: Chain) => void;

export class BlockchainDataSource {
  private provider: JsonRpcProvider;
  private connected: boolean = false;
  private currentChain: Chain;
  private blockCallbacks: BlockCallback[] = [];
  private txCallbacks: TransactionCallback[] = [];
  private chainChangeCallbacks: ChainChangeCallback[] = [];
  private pollingInterval: NodeJS.Timeout | null = null;
  private lastBlockNumber: number = 0;

  constructor(chainOrUrl: Chain | string) {
    // Support both Chain object and string URL for backwards compatibility
    if (typeof chainOrUrl === 'string') {
      // Try to find matching chain, or use Warden as default
      this.currentChain = CHAINS.find(c => c.rpcUrl === chainOrUrl) || getChainById(DEFAULT_CHAIN)!;
    } else {
      this.currentChain = chainOrUrl;
    }
    this.provider = new JsonRpcProvider(this.currentChain.rpcUrl);
  }

  getChain(): Chain {
    return this.currentChain;
  }

  async switchChain(chainId: string): Promise<boolean> {
    const newChain = getChainById(chainId);
    if (!newChain) {
      console.error(`Unknown chain: ${chainId}`);
      return false;
    }

    if (newChain.id === this.currentChain.id) {
      console.log(`Already on chain: ${newChain.name}`);
      return true;
    }

    console.log(`Switching from ${this.currentChain.name} to ${newChain.name}...`);
    
    // Disconnect from current chain
    this.disconnect();
    
    // Update chain and provider
    this.currentChain = newChain;
    this.provider = new JsonRpcProvider(newChain.rpcUrl);
    this.lastBlockNumber = 0;
    
    // Reconnect
    const success = await this.connect();
    
    if (success) {
      // Notify chain change callbacks
      for (const callback of this.chainChangeCallbacks) {
        callback(newChain);
      }
    }
    
    return success;
  }

  onChainChange(callback: ChainChangeCallback): void {
    this.chainChangeCallbacks.push(callback);
  }

  async connect(): Promise<boolean> {
    try {
      const network = await this.provider.getNetwork();
      console.log(`Connected to ${this.currentChain.name} chain:`, network);
      this.connected = true;
      
      // Start polling for new blocks
      this.startPolling();
      
      return true;
    } catch (error) {
      console.error(`Failed to connect to ${this.currentChain.name} chain:`, error);
      return false;
    }
  }

  private startPolling(): void {
    // Adjust polling interval based on chain's block time
    // Default to 2 seconds, but use chain's block time if available
    const pollInterval = this.currentChain.blockTime ? Math.max(1000, this.currentChain.blockTime * 500) : 2000;
    
    this.pollingInterval = setInterval(async () => {
      try {
        const blockNumber = await this.provider.getBlockNumber();
        
        if (blockNumber > this.lastBlockNumber) {
          // Fetch new blocks
          for (let i = this.lastBlockNumber + 1; i <= blockNumber; i++) {
            const block = await this.provider.getBlock(i, true) as EthersBlock | null;
            if (block) {
              this.processBlock(block);
            }
          }
          this.lastBlockNumber = blockNumber;
        }
      } catch (error) {
        console.error('Error polling for blocks:', error);
      }
    }, pollInterval);
  }

  private async processBlock(block: EthersBlock): Promise<void> {
    const hashStr = typeof block.hash === 'string' ? block.hash : '';
    const processedBlock: Block = {
      number: block.number,
      hash: hashStr,
      timestamp: block.timestamp,
      transactions: block.transactions.map((tx: string | TransactionResponse) => 
        typeof tx === 'string' ? tx : (tx as TransactionResponse).hash
      ),
      gasUsed: block.gasUsed.toString(),
      gasLimit: block.gasLimit.toString(),
      parentHash: block.parentHash,
    };
    
    // Notify block callbacks
    for (const callback of this.blockCallbacks) {
      callback(processedBlock);
    }
    
    // Fetch and process transactions
    for (const txHash of processedBlock.transactions) {
      try {
        const tx = await this.provider.getTransaction(txHash);
        if (tx) {
          const processedTx = await this.processTransaction(tx);
          for (const callback of this.txCallbacks) {
            callback(processedTx);
          }
        }
      } catch (error) {
        console.error('Error fetching transaction:', error);
      }
    }
  }

  private async processTransaction(tx: TransactionResponse): Promise<Transaction> {
    // Determine transaction type
    let type: 'transfer' | 'contract' | 'token' | 'inference' = 'transfer';
    
    // Get the proof of inference address for current chain (if any)
    const proofOfInferenceAddress = this.currentChain.contracts?.proofOfInference?.toLowerCase();
    
    // Check if this is a native coin transfer
    const hasValue = tx.value > 0n;
    
    // ERC-20 transfer function selector: 0xa9059cbb (transfer(address,uint256))
    // ERC-20 transferFrom selector: 0x23b872dd (transferFrom(address,address,uint256))
    const ERC20_TRANSFER_SELECTOR = '0xa9059cbb';
    const ERC20_TRANSFER_FROM_SELECTOR = '0x23b872dd';
    
    if (tx.to === null) {
      type = 'contract'; // Contract creation
    } else if (proofOfInferenceAddress && tx.to.toLowerCase() === proofOfInferenceAddress) {
      type = 'inference'; // Proof Of Inference contract call (chain-specific)
    } else if (tx.data && tx.data.length >= 10) {
      // Check for ERC-20 token transfer
      const selector = tx.data.slice(0, 10).toLowerCase();
      if (selector === ERC20_TRANSFER_SELECTOR || selector === ERC20_TRANSFER_FROM_SELECTOR) {
        type = 'token'; // ERC-20 token transfer
      } else {
        type = 'contract'; // Other contract call
      }
    } else if (hasValue) {
      // Native coin transfer (WARD)
      type = 'transfer';
    } else if (tx.data && tx.data.length > 2) {
      // Contract call without value (likely ERC-20 approve or similar)
      type = 'contract';
    }
    
    return {
      hash: tx.hash,
      blockNumber: tx.blockNumber || 0,
      from: tx.from,
      to: tx.to,
      value: tx.value.toString(),
      gasPrice: tx.gasPrice?.toString() || '0',
      type,
    };
  }

  async getLatestBlock(): Promise<Block | null> {
    try {
      const block = await this.provider.getBlock('latest', true) as EthersBlock | null;
      if (block) {
        this.lastBlockNumber = block.number;
        return {
          number: block.number,
          hash: block.hash || '',
          timestamp: block.timestamp,
          transactions: block.transactions.map((tx: string | TransactionResponse) => 
            typeof tx === 'string' ? tx : tx.hash
          ),
          gasUsed: block.gasUsed.toString(),
          gasLimit: block.gasLimit.toString(),
          parentHash: block.parentHash,
        };
      }
      return null;
    } catch (error) {
      console.error('Error fetching latest block:', error);
      return null;
    }
  }

  async getBlock(number: number): Promise<Block | null> {
    try {
      const block = await this.provider.getBlock(number, true) as EthersBlock | null;
      if (block) {
        return {
          number: block.number,
          hash: block.hash || '',
          timestamp: block.timestamp,
          transactions: block.transactions.map((tx: string | TransactionResponse) => 
            typeof tx === 'string' ? tx : tx.hash
          ),
          gasUsed: block.gasUsed.toString(),
          gasLimit: block.gasLimit.toString(),
          parentHash: block.parentHash,
        };
      }
      return null;
    } catch (error) {
      console.error('Error fetching block:', error);
      return null;
    }
  }

  onBlock(callback: BlockCallback): void {
    this.blockCallbacks.push(callback);
  }

  onTransaction(callback: TransactionCallback): void {
    this.txCallbacks.push(callback);
  }

  disconnect(): void {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
    this.connected = false;
  }

  isConnected(): boolean {
    return this.connected;
  }
}