/**
 * InfoPopup - Displays detailed information about blocks and transactions
 * Appears when clicking on visual elements
 */

export interface BlockInfo {
  number: number;
  hash: string;
  timestamp: number;
  transactions: string[];
  gasUsed: string;
  gasLimit: string;
  parentHash: string;
}

export interface TransactionInfo {
  hash: string;
  blockNumber: number;
  from: string;
  to: string | null;
  value: string;
  gasPrice: string;
  type: 'transfer' | 'contract' | 'token' | 'inference';
}

type InfoType = 'block' | 'transaction';

export class InfoPopup {
  private container: HTMLDivElement;
  private isVisible: boolean = false;
  private currentType: InfoType | null = null;
  private explorerBaseUrl: string = 'https://explorer.wardenprotocol.org';

  constructor() {
    this.container = document.createElement('div');
    this.container.id = 'info-popup';
    this.container.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: rgba(15, 15, 25, 0.98);
      border: 1px solid rgba(167, 139, 250, 0.5);
      border-radius: 16px;
      padding: 24px;
      min-width: 380px;
      max-width: 500px;
      max-height: 80vh;
      overflow-y: auto;
      z-index: 1000;
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
      color: #e0e0e0;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5), 0 0 60px rgba(167, 139, 250, 0.15);
      backdrop-filter: blur(20px);
      display: none;
    `;
    
    document.body.appendChild(this.container);
    this.setupCloseOnOutsideClick();
    this.setupCloseOnEscape();
  }

  private setupCloseOnOutsideClick(): void {
    document.addEventListener('click', (e) => {
      if (this.isVisible && !this.container.contains(e.target as Node)) {
        const txScroll = document.getElementById('tx-hash-scroll');
        const canvas = document.getElementById('main-canvas');
        if (!txScroll?.contains(e.target as Node) && !canvas?.contains(e.target as Node)) {
          this.hide();
        }
      }
    });
  }

  private setupCloseOnEscape(): void {
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isVisible) {
        this.hide();
      }
    });
  }

  showBlock(block: BlockInfo): void {
    this.currentType = 'block';
    const txList = block.transactions.length > 0
      ? block.transactions.slice(0, 5).map(tx => `
          <div style="margin: 4px 0; font-size: 11px;">
            <a href="${this.explorerBaseUrl}/tx/${tx}" target="_blank" 
               style="color: #60a5fa; text-decoration: none; word-break: break-all;">
              ${this.formatHash(tx)}
            </a>
          </div>
        `).join('') + 
        (block.transactions.length > 5 ? `<div style="color: #666; font-size: 11px; margin-top: 4px;">+${block.transactions.length - 5} more transactions</div>` : '')
      : '<div style="color: #666; font-size: 12px;">No transactions</div>';

    this.container.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
        <h3 style="color: #fbbf24; font-size: 18px; font-weight: 600; margin: 0;">
          Block #${block.number.toLocaleString()}
        </h3>
        <button id="close-popup" style="
          background: rgba(255, 255, 255, 0.1);
          border: none;
          color: #888;
          font-size: 20px;
          cursor: pointer;
          padding: 4px 10px;
          border-radius: 6px;
          transition: all 0.2s;
        ">×</button>
      </div>
      
      <div style="display: grid; gap: 12px;">
        <div style="background: rgba(30, 30, 45, 0.6); padding: 12px; border-radius: 8px;">
          <div style="color: #888; font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px;">Block Hash</div>
          <a href="${this.explorerBaseUrl}/block/${block.number}" target="_blank" 
             style="color: #60a5fa; text-decoration: none; word-break: break-all; font-size: 12px;">
            ${block.hash}
          </a>
        </div>
        
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
          <div style="background: rgba(30, 30, 45, 0.6); padding: 12px; border-radius: 8px;">
            <div style="color: #888; font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px;">Timestamp</div>
            <div style="color: #e0e0e0; font-size: 14px;">${this.formatTimestamp(block.timestamp)}</div>
          </div>
          <div style="background: rgba(30, 30, 45, 0.6); padding: 12px; border-radius: 8px;">
            <div style="color: #888; font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px;">Transactions</div>
            <div style="color: #34d399; font-size: 14px;">${block.transactions.length}</div>
          </div>
        </div>
        
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
          <div style="background: rgba(30, 30, 45, 0.6); padding: 12px; border-radius: 8px;">
            <div style="color: #888; font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px;">Gas Used</div>
            <div style="color: #e0e0e0; font-size: 14px;">${this.formatGas(block.gasUsed)}</div>
          </div>
          <div style="background: rgba(30, 30, 45, 0.6); padding: 12px; border-radius: 8px;">
            <div style="color: #888; font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px;">Gas Limit</div>
            <div style="color: #e0e0e0; font-size: 14px;">${this.formatGas(block.gasLimit)}</div>
          </div>
        </div>
        
        <div style="background: rgba(30, 30, 45, 0.6); padding: 12px; border-radius: 8px;">
          <div style="color: #888; font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px;">Transactions</div>
          ${txList}
        </div>
        
        <div style="text-align: center; margin-top: 8px;">
          <a href="${this.explorerBaseUrl}/block/${block.number}" target="_blank"
             style="color: #a78bfa; text-decoration: none; font-size: 12px; padding: 8px 16px; 
                    background: rgba(167, 139, 250, 0.1); border-radius: 6px; display: inline-block;">
            View on Explorer →
          </a>
        </div>
      </div>
    `;

    this.attachCloseHandler();
    this.show();
  }

  showTransaction(tx: TransactionInfo): void {
    this.currentType = 'transaction';
    const typeColors: { [key: string]: string } = {
      transfer: '#60a5fa',
      token: '#34d399',
      contract: '#f472b6',
      inference: '#a78bfa'
    };
    const typeLabels: { [key: string]: string } = {
      transfer: 'Native Transfer',
      token: 'Token Transfer',
      contract: 'Contract Call',
      inference: 'Proof of Inference'
    };
    const color = typeColors[tx.type] || '#60a5fa';
    const label = typeLabels[tx.type] || tx.type;

    const valueWei = BigInt(tx.value);
    const valueEth = Number(valueWei) / 1e18;
    const valueDisplay = valueEth > 0 ? `${valueEth.toFixed(6)} WARD` : '0 WARD';

    const gasPriceGwei = tx.gasPrice ? (Number(BigInt(tx.gasPrice)) / 1e9).toFixed(2) : '0';

    this.container.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
        <h3 style="color: ${color}; font-size: 18px; font-weight: 600; margin: 0;">
          Transaction
        </h3>
        <button id="close-popup" style="
          background: rgba(255, 255, 255, 0.1);
          border: none;
          color: #888;
          font-size: 20px;
          cursor: pointer;
          padding: 4px 10px;
          border-radius: 6px;
          transition: all 0.2s;
        ">×</button>
      </div>
      
      <div style="display: grid; gap: 12px;">
        <div style="background: rgba(30, 30, 45, 0.6); padding: 12px; border-radius: 8px;">
          <div style="color: #888; font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px;">Transaction Hash</div>
          <a href="${this.explorerBaseUrl}/tx/${tx.hash}" target="_blank" 
             style="color: #60a5fa; text-decoration: none; word-break: break-all; font-size: 12px;">
            ${tx.hash}
          </a>
        </div>
        
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
          <div style="background: rgba(30, 30, 45, 0.6); padding: 12px; border-radius: 8px;">
            <div style="color: #888; font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px;">Type</div>
            <div style="color: ${color}; font-size: 14px; font-weight: 500;">${label}</div>
          </div>
          <div style="background: rgba(30, 30, 45, 0.6); padding: 12px; border-radius: 8px;">
            <div style="color: #888; font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px;">Block</div>
            <a href="${this.explorerBaseUrl}/block/${tx.blockNumber}" target="_blank"
               style="color: #fbbf24; text-decoration: none; font-size: 14px;">
              #${tx.blockNumber.toLocaleString()}
            </a>
          </div>
        </div>
        
        <div style="background: rgba(30, 30, 45, 0.6); padding: 12px; border-radius: 8px;">
          <div style="color: #888; font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px;">From</div>
          <a href="${this.explorerBaseUrl}/address/${tx.from}" target="_blank" 
             style="color: #60a5fa; text-decoration: none; word-break: break-all; font-size: 12px;">
            ${tx.from}
          </a>
        </div>
        
        ${tx.to ? `
          <div style="background: rgba(30, 30, 45, 0.6); padding: 12px; border-radius: 8px;">
            <div style="color: #888; font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px;">To</div>
            <a href="${this.explorerBaseUrl}/address/${tx.to}" target="_blank" 
               style="color: #60a5fa; text-decoration: none; word-break: break-all; font-size: 12px;">
              ${tx.to}
            </a>
          </div>
        ` : `
          <div style="background: rgba(30, 30, 45, 0.6); padding: 12px; border-radius: 8px;">
            <div style="color: #888; font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px;">To</div>
            <div style="color: #f472b6; font-size: 14px;">Contract Creation</div>
          </div>
        `}
        
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
          <div style="background: rgba(30, 30, 45, 0.6); padding: 12px; border-radius: 8px;">
            <div style="color: #888; font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px;">Value</div>
            <div style="color: #34d399; font-size: 14px; font-weight: 500;">${valueDisplay}</div>
          </div>
          <div style="background: rgba(30, 30, 45, 0.6); padding: 12px; border-radius: 8px;">
            <div style="color: #888; font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px;">Gas Price</div>
            <div style="color: #e0e0e0; font-size: 14px;">${gasPriceGwei} Gwei</div>
          </div>
        </div>
        
        <div style="text-align: center; margin-top: 8px;">
          <a href="${this.explorerBaseUrl}/tx/${tx.hash}" target="_blank"
             style="color: #a78bfa; text-decoration: none; font-size: 12px; padding: 8px 16px; 
                    background: rgba(167, 139, 250, 0.1); border-radius: 6px; display: inline-block;">
            View on Explorer →
          </a>
        </div>
      </div>
    `;

    this.attachCloseHandler();
    this.show();
  }

  private attachCloseHandler(): void {
    const closeBtn = document.getElementById('close-popup');
    if (closeBtn) {
      closeBtn.onclick = () => this.hide();
      closeBtn.onmouseover = () => { closeBtn.style.background = 'rgba(255, 255, 255, 0.2)'; };
      closeBtn.onmouseout = () => { closeBtn.style.background = 'rgba(255, 255, 255, 0.1)'; };
    }
  }

  private show(): void {
    this.container.style.display = 'block';
    this.isVisible = true;
  }

  hide(): void {
    this.container.style.display = 'none';
    this.isVisible = false;
    this.currentType = null;
  }

  toggle(): void {
    if (this.isVisible) {
      this.hide();
    }
  }

  private formatHash(hash: string): string {
    if (hash.length <= 16) return hash;
    return `${hash.slice(0, 8)}…${hash.slice(-6)}`;
  }

  private formatTimestamp(timestamp: number): string {
    const date = new Date(timestamp * 1000);
    return date.toLocaleString();
  }

  private formatGas(gas: string): string {
    const num = BigInt(gas);
    return Number(num).toLocaleString();
  }

  showLegendInfo(type: string): void {
    const legendData: { [key: string]: { title: string; color: string; description: string } } = {
      block: {
        title: 'Block',
        color: '#fbbf24',
        description: 'A block is a collection of transactions on the Warden blockchain. In Wardenverse, blocks appear as glowing golden stars or planets. The size reflects the number of transactions inside. Click on any block to see its details.'
      },
      transaction: {
        title: 'Transaction',
        color: '#a78bfa',
        description: 'A transaction is an action on the blockchain - sending tokens, calling a smart contract, or other operations. Transactions appear as violet comets streaking across the universe, leaving particle trails in their wake.'
      },
      token: {
        title: 'Token Transfer',
        color: '#34d399',
        description: 'Token transfers are transactions that move tokens between addresses. They appear as bright green comets with intense sparkle effects and larger particle trails, representing the flow of value through the network.'
      },
      contract: {
        title: 'Contract Call',
        color: '#f472b6',
        description: 'Contract calls are transactions that interact with smart contracts. They appear as pink comets with plasma and lightning effects, representing the computational energy of decentralized applications.'
      }
    };

    const info = legendData[type];
    if (!info) return;

    this.container.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
        <h3 style="color: ${info.color}; font-size: 18px; font-weight: 600; margin: 0;">
          ${info.title}
        </h3>
        <button id="close-popup" style="
          background: rgba(255, 255, 255, 0.1);
          border: none;
          color: #888;
          font-size: 20px;
          cursor: pointer;
          padding: 4px 10px;
          border-radius: 6px;
          transition: all 0.2s;
        ">×</button>
      </div>
      
      <div style="color: #c0c0c0; font-size: 14px; line-height: 1.6;">
        ${info.description}
      </div>
    `;

    this.attachCloseHandler();
    this.show();
  }

  destroy(): void {
    if (this.container.parentNode) {
      this.container.parentNode.removeChild(this.container);
    }
  }
}