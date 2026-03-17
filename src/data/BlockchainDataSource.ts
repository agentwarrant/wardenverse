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

export interface ChainStats {
  totalTransactions: number;
  totalBlocks: number;
  lastUpdated: number;
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
  private wasHidden: boolean = false; // Track if tab was hidden
  private maxBlocksPerPoll: number = 5; // Limit blocks processed per poll to avoid TPS spikes
  private visibilityHandler: (() => void) | null = null; // Store handler for cleanup

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
    
    // Track tab visibility to detect when user switches tabs
    this.visibilityHandler = () => {
      if (document.visibilityState === 'hidden') {
        this.wasHidden = true;
        console.log('Tab hidden - will skip old blocks on return');
      }
    };
    document.addEventListener('visibilitychange', this.visibilityHandler);
    
    this.pollingInterval = setInterval(async () => {
      try {
        const blockNumber = await this.provider.getBlockNumber();
        
        if (blockNumber > this.lastBlockNumber) {
          // If tab was hidden, skip to the latest block instead of processing all missed ones
          // This prevents TPS spikes when returning to the tab after being away
          if (this.wasHidden) {
            console.log(`Tab was hidden - skipping from block ${this.lastBlockNumber} to ${blockNumber} (${blockNumber - this.lastBlockNumber} blocks skipped)`);
            this.lastBlockNumber = blockNumber - 1; // Process only the latest block
            this.wasHidden = false;
          }
          
          // Limit the number of blocks processed per poll to avoid overwhelming the UI
          // This prevents TPS spikes from burst processing
          const blocksToProcess = Math.min(blockNumber - this.lastBlockNumber, this.maxBlocksPerPoll);
          const startBlock = blockNumber - blocksToProcess + 1;
          
          for (let i = startBlock; i <= blockNumber; i++) {
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
          // Process transaction - may return multiple visualizations
          const processedTxs = await this.processTransaction(tx);
          // Emit each visualization type
          for (const processedTx of processedTxs) {
            for (const callback of this.txCallbacks) {
              callback(processedTx);
            }
          }
        }
      } catch (error) {
        console.error('Error fetching transaction:', error);
      }
    }
  }

  private async processTransaction(tx: TransactionResponse): Promise<Transaction[]> {
    // Goal: Maximum visual activity - emit multiple comets per transaction
    // Every transaction gets a base comet, PLUS additional comets for special types
    
    // Get the proof of inference address for current chain (if any)
    const proofOfInferenceAddress = this.currentChain.contracts?.proofOfInference?.toLowerCase();
    
    // Check if this is a native coin transfer (WARD sent)
    const hasValue = tx.value > 0n;
    const hasData = tx.data && tx.data.length > 2;
    
    // ERC-20 transfer function selector: 0xa9059cbb (transfer(address,uint256))
    // ERC-20 transferFrom selector: 0x23b872dd (transferFrom(address,address,uint256))
    const ERC20_TRANSFER_SELECTOR = '0xa9059cbb';
    const ERC20_TRANSFER_FROM_SELECTOR = '0x23b872dd';
    
    // Determine all applicable types for this transaction
    const types: ('transfer' | 'contract' | 'token' | 'inference')[] = [];
    let isERC20Transfer = false;
    let isInference = false;
    
    // Check for ERC-20 token transfer
    if (tx.data && tx.data.length >= 10) {
      const selector = tx.data.slice(0, 10).toLowerCase();
      if (selector === ERC20_TRANSFER_SELECTOR || selector === ERC20_TRANSFER_FROM_SELECTOR) {
        isERC20Transfer = true;
      }
    }
    
    // Check for Proof of Inference - Warden's onchain audit trail for AI Agents
    // that links payments to user prompts and inferences, creating verifiable
    // proof that a specific inference request was made and paid for
    if (tx.to !== null && proofOfInferenceAddress && tx.to.toLowerCase() === proofOfInferenceAddress) {
      isInference = true;
    }
    
    // Base transaction type (always shown)
    if (tx.to === null) {
      // Contract creation - always show as contract
      types.push('contract');
    } else if (hasValue) {
      // Native transfer - always show as transfer comet (blue)
      types.push('transfer');
    } else if (hasData) {
      // Contract call without value - show as contract comet (pink)
      types.push('contract');
    } else {
      // Default: plain transaction
      types.push('transfer');
    }
    
    // Additional visualizations for special types
    
    // ANY WARD transfer (value > 0) shows green token comet
    // This reflects WARD being sent - whether as gas, payment, or token send
    if (hasValue) {
      types.push('token');
    }
    
    // ERC-20 token transfer - add green token comet (in addition to native if any)
    if (isERC20Transfer) {
      types.push('token');
    }
    
    if (isInference) {
      // Proof of Inference - add red explosion effect (in addition to base)
      types.push('inference');
    }
    
    // Create transaction objects for each type
    const baseTx = {
      hash: tx.hash,
      blockNumber: tx.blockNumber || 0,
      from: tx.from,
      to: tx.to,
      value: tx.value.toString(),
      gasPrice: tx.gasPrice?.toString() || '0',
    };
    
    return types.map(type => ({ ...baseTx, type }));
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
    // Remove visibility change listener
    if (this.visibilityHandler) {
      document.removeEventListener('visibilitychange', this.visibilityHandler);
      this.visibilityHandler = null;
    }
    this.connected = false;
    this.wasHidden = false;
  }

  isConnected(): boolean {
    return this.connected;
  }

  /**
   * Get a transaction by hash
   */
  async getTransaction(txHash: string): Promise<Transaction | null> {
    try {
      const tx = await this.provider.getTransaction(txHash);
      if (!tx) return null;
      
      // Get the receipt to determine transaction type more accurately
      const receipt = await this.provider.getTransactionReceipt(txHash);
      
      // Determine transaction type
      let type: TransactionType = 'transfer';
      
      // Check for Proof of Inference - Warden's onchain audit trail for AI Agents
      const proofOfInferenceAddress = this.currentChain.contracts?.proofOfInference?.toLowerCase();
      if (tx.to && proofOfInferenceAddress && tx.to.toLowerCase() === proofOfInferenceAddress) {
        type = 'inference';
      } else if (tx.to === null) {
        type = 'contract'; // Contract creation
      } else if (tx.data && tx.data.length > 2) {
        // Check for ERC-20 transfer
        const ERC20_TRANSFER_SELECTOR = '0xa9059cbb';
        const ERC20_TRANSFER_FROM_SELECTOR = '0x23b872dd';
        const selector = tx.data.slice(0, 10).toLowerCase();
        if (selector === ERC20_TRANSFER_SELECTOR || selector === ERC20_TRANSFER_FROM_SELECTOR) {
          type = 'token';
        } else if (tx.value > 0n) {
          type = 'transfer';
        } else {
          type = 'contract';
        }
      } else if (tx.value > 0n) {
        type = 'transfer';
      }
      
      return {
        hash: tx.hash,
        blockNumber: tx.blockNumber || 0,
        from: tx.from,
        to: tx.to,
        value: tx.value.toString(),
        gasPrice: tx.gasPrice?.toString() || '0',
        type
      };
    } catch (error) {
      console.error('Error fetching transaction:', error);
      return null;
    }
  }

  /**
   * Get a block by number or hash
   */
  async getBlockByNumber(number: number): Promise<Block | null> {
    try {
      const block = await this.provider.getBlock(number, true) as EthersBlock | null;
      if (!block) return null;
      
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
    } catch (error) {
      console.error('Error fetching block by number:', error);
      return null;
    }
  }

  /**
   * Get a block by hash
   */
  async getBlockByHash(hash: string): Promise<Block | null> {
    try {
      const block = await this.provider.getBlock(hash, true) as EthersBlock | null;
      if (!block) return null;
      
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
    } catch (error) {
      console.error('Error fetching block by hash:', error);
      return null;
    }
  }

  /**
   * Search for a transaction or block by hash/number
   * Returns null if not found
   */
  async search(query: string): Promise<{ type: 'transaction' | 'block'; data: unknown } | null> {
    const trimmed = query.trim().toLowerCase();
    
    // Try as block number first (if purely numeric)
    if (/^\d+$/.test(trimmed)) {
      const blockNum = parseInt(trimmed, 10);
      const block = await this.getBlockByNumber(blockNum);
      if (block) {
        return { type: 'block', data: block };
      }
      return null;
    }
    
    // Try as transaction hash (64 hex chars)
    if (/^0x[a-fA-F0-9]{64}$/.test(trimmed)) {
      // Try as transaction first
      const tx = await this.getTransaction(trimmed);
      if (tx) {
        return { type: 'transaction', data: tx };
      }
      
      // If not a tx, try as block hash
      const block = await this.getBlockByHash(trimmed);
      if (block) {
        return { type: 'block', data: block };
      }
    }
    
    return null;
  }

  /**
   * Fetch chain statistics including total transactions
   * Tries multiple API endpoints to get total transaction count
   */
  async getChainStats(): Promise<ChainStats | null> {
    const statsApiUrl = this.currentChain.statsApiUrl;
    
    if (!statsApiUrl) {
      console.log('No stats API URL configured for this chain');
      return null;
    }

    try {
      // Try Blockscout-style API endpoint for stats
      const response = await fetch(`${statsApiUrl}/stats`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        console.log(`Stats API returned ${response.status}, trying alternative...`);
        return null;
      }

      const data = await response.json();
      
      // Blockscout API returns stats in this format
      const stats: ChainStats = {
        totalTransactions: data.transactions_count || data.total_transactions || 0,
        totalBlocks: data.blocks_count || data.total_blocks || 0,
        lastUpdated: Date.now(),
      };

      console.log(`Chain stats from API: ${stats.totalTransactions.toLocaleString()} total transactions`);
      return stats;
    } catch (error) {
      console.error('Error fetching chain stats:', error);
      return null;
    }
  }
}