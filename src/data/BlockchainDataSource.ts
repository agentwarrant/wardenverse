/**
 * Blockchain Data Source - Connects to Warden EVM RPC
 * Fetches blocks and transactions for visualization
 */

import { JsonRpcProvider, Block as EthersBlock, TransactionResponse } from 'ethers';
import { PROOF_OF_INFERENCE_ADDRESS } from '../core/Config';

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

export class BlockchainDataSource {
  private provider: JsonRpcProvider;
  private connected: boolean = false;
  private blockCallbacks: BlockCallback[] = [];
  private txCallbacks: TransactionCallback[] = [];
  private pollingInterval: NodeJS.Timeout | null = null;
  private lastBlockNumber: number = 0;

  constructor(rpcUrl: string) {
    this.provider = new JsonRpcProvider(rpcUrl);
  }

  async connect(): Promise<boolean> {
    try {
      const network = await this.provider.getNetwork();
      console.log('Connected to Warden chain:', network);
      this.connected = true;
      
      // Start polling for new blocks
      this.startPolling();
      
      return true;
    } catch (error) {
      console.error('Failed to connect to Warden chain:', error);
      return false;
    }
  }

  private startPolling(): void {
    // Poll every 2 seconds for new blocks
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
    }, 2000);
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
    
    // Check if this is a native coin transfer (WARD)
    const hasValue = tx.value > 0n;
    
    if (tx.to === null) {
      type = 'contract'; // Contract creation
    } else if (tx.to.toLowerCase() === PROOF_OF_INFERENCE_ADDRESS) {
      type = 'inference'; // Proof Of Inference contract call
    } else if (hasValue) {
      // Native coin transfer (WARD) - show as token with floating coins
      type = 'token';
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
}