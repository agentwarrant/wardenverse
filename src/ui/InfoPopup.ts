/**
 * InfoPopup - Game-style info panels for blocks and transactions
 * RPG dialog box aesthetic with pixel-art borders and animations
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

// Pixel-art style icons for transaction types (8x8 scaled to 16x16)
const TRANSACTION_ICONS: { [key: string]: string } = {
  transfer: `
    <svg viewBox="0 0 16 16" width="16" height="16" style="image-rendering: pixelated;">
      <rect x="2" y="6" width="6" height="4" fill="#60a5fa"/>
      <rect x="8" y="6" width="2" height="4" fill="#3b82f6"/>
      <rect x="10" y="4" width="4" height="2" fill="#60a5fa"/>
      <rect x="10" y="10" width="4" height="2" fill="#60a5fa"/>
      <rect x="12" y="6" width="2" height="4" fill="#60a5fa"/>
    </svg>
  `,
  token: `
    <svg viewBox="0 0 16 16" width="16" height="16" style="image-rendering: pixelated;">
      <rect x="4" y="2" width="8" height="2" fill="#34d399"/>
      <rect x="2" y="4" width="2" height="8" fill="#34d399"/>
      <rect x="12" y="4" width="2" height="8" fill="#34d399"/>
      <rect x="4" y="12" width="8" height="2" fill="#34d399"/>
      <rect x="6" y="6" width="4" height="4" fill="#6ee7b7"/>
      <rect x="7" y="7" width="2" height="2" fill="#a7f3d0"/>
    </svg>
  `,
  contract: `
    <svg viewBox="0 0 16 16" width="16" height="16" style="image-rendering: pixelated;">
      <rect x="3" y="2" width="10" height="2" fill="#f472b6"/>
      <rect x="3" y="4" width="2" height="10" fill="#f472b6"/>
      <rect x="11" y="4" width="2" height="10" fill="#f472b6"/>
      <rect x="5" y="6" width="2" height="2" fill="#fbcfe8"/>
      <rect x="9" y="6" width="2" height="2" fill="#fbcfe8"/>
      <rect x="5" y="10" width="6" height="2" fill="#fbcfe8"/>
    </svg>
  `,
  inference: `
    <svg viewBox="0 0 16 16" width="16" height="16" style="image-rendering: pixelated;">
      <rect x="6" y="1" width="4" height="2" fill="#a78bfa"/>
      <rect x="4" y="3" width="8" height="2" fill="#a78bfa"/>
      <rect x="3" y="5" width="10" height="2" fill="#c4b5fd"/>
      <rect x="4" y="7" width="8" height="2" fill="#a78bfa"/>
      <rect x="5" y="9" width="6" height="2" fill="#c4b5fd"/>
      <rect x="6" y="11" width="4" height="2" fill="#a78bfa"/>
      <rect x="7" y="13" width="2" height="2" fill="#c4b5fd"/>
      <rect x="2" y="5" width="2" height="2" fill="#c4b5fd"/>
      <rect x="12" y="5" width="2" height="2" fill="#c4b5fd"/>
    </svg>
  `
};

const BLOCK_ICON = `
  <svg viewBox="0 0 16 16" width="16" height="16" style="image-rendering: pixelated;">
    <rect x="3" y="1" width="10" height="2" fill="#fbbf24"/>
    <rect x="1" y="3" width="2" height="10" fill="#fbbf24"/>
    <rect x="13" y="3" width="2" height="10" fill="#fbbf24"/>
    <rect x="3" y="13" width="10" height="2" fill="#fbbf24"/>
    <rect x="5" y="5" width="6" height="6" fill="#fef3c7"/>
    <rect x="6" y="6" width="4" height="4" fill="#fcd34d"/>
    <rect x="7" y="7" width="2" height="2" fill="#fbbf24"/>
  </svg>
`;

export class InfoPopup {
  private container: HTMLDivElement;
  private overlay: HTMLDivElement;
  private particleCanvas: HTMLCanvasElement | null = null;
  private particleCtx: CanvasRenderingContext2D | null = null;
  private particles: Array<{x: number; y: number; vx: number; vy: number; life: number; size: number; color: string}> = [];
  private animationFrame: number | null = null;
  private isVisible: boolean = false;
  private currentType: InfoType | null = null;
  private explorerBaseUrl: string = 'https://explorer.wardenprotocol.org';

  constructor() {
    // Create overlay backdrop
    this.overlay = document.createElement('div');
    this.overlay.id = 'info-popup-overlay';
    this.overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.6);
      z-index: 999;
      display: none;
      opacity: 0;
      transition: opacity 0.3s ease;
    `;
    document.body.appendChild(this.overlay);

    // Create main container with game-style frame
    this.container = document.createElement('div');
    this.container.id = 'info-popup';
    this.container.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%) scale(0.9);
      z-index: 1000;
      display: none;
      opacity: 0;
      transition: opacity 0.2s ease, transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
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

  private createGameFrame(title: string, icon: string, accentColor: string): string {
    return `
      <style>
        @keyframes scanline {
          0% { transform: translateY(-100%); }
          100% { transform: translateY(100%); }
        }
        @keyframes shimmer {
          0% { opacity: 0.3; }
          50% { opacity: 0.6; }
          100% { opacity: 0.3; }
        }
        .game-panel {
          position: relative;
          background: linear-gradient(180deg, rgba(20, 20, 35, 0.98) 0%, rgba(15, 15, 25, 0.98) 100%);
          border: 4px solid;
          border-image: linear-gradient(180deg, ${accentColor}ff 0%, ${accentColor}88 50%, ${accentColor}ff 100%) 1;
          image-rendering: pixelated;
          min-width: 420px;
          max-width: 520px;
          max-height: 85vh;
          overflow-y: auto;
          scrollbar-width: none;  /* Firefox */
          -ms-overflow-style: none;  /* IE and Edge */
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
        }
        .game-panel::-webkit-scrollbar {
          display: none;  /* Chrome, Safari, Opera */
        }
        .game-panel::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: repeating-linear-gradient(
            0deg,
            transparent,
            transparent 2px,
            rgba(0, 0, 0, 0.03) 2px,
            rgba(0, 0, 0, 0.03) 4px
          );
          pointer-events: none;
        }
        .game-panel::after {
          content: '';
          position: absolute;
          top: -100%;
          left: 0;
          right: 0;
          height: 100%;
          background: linear-gradient(
            180deg,
            transparent 0%,
            rgba(255, 255, 255, 0.02) 50%,
            transparent 100%
          );
          animation: scanline 8s linear infinite;
          pointer-events: none;
        }
        .pixel-corner-tl, .pixel-corner-tr, .pixel-corner-bl, .pixel-corner-br {
          position: absolute;
          width: 8px;
          height: 8px;
          background: ${accentColor};
          image-rendering: pixelated;
        }
        .pixel-corner-tl { top: -4px; left: -4px; }
        .pixel-corner-tr { top: -4px; right: -4px; }
        .pixel-corner-bl { bottom: -4px; left: -4px; }
        .pixel-corner-br { bottom: -4px; right: -4px; }
        .game-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 16px 20px;
          background: linear-gradient(90deg, 
            rgba(0, 0, 0, 0.4) 0%, 
            rgba(${this.hexToRgb(accentColor)}, 0.15) 50%,
            rgba(0, 0, 0, 0.4) 100%
          );
          border-bottom: 2px solid ${accentColor}44;
          position: relative;
        }
        .game-header::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 2px;
          background: linear-gradient(90deg, transparent, ${accentColor}, transparent);
          animation: shimmer 3s ease-in-out infinite;
        }
        .game-title {
          display: flex;
          align-items: center;
          gap: 12px;
          font-family: 'Press Start 2P', cursive;
          font-size: 11px;
          color: ${accentColor};
          text-shadow: 0 0 10px ${accentColor}66, 2px 2px 0 rgba(0,0,0,0.5);
          letter-spacing: 0.5px;
        }
        .game-close {
          background: rgba(255, 100, 100, 0.2);
          border: 2px solid #ff6666;
          color: #ff9999;
          font-size: 14px;
          font-family: 'Press Start 2P', cursive;
          cursor: pointer;
          padding: 6px 10px;
          image-rendering: pixelated;
          transition: all 0.15s ease;
          text-shadow: 1px 1px 0 rgba(0,0,0,0.5);
        }
        .game-close:hover {
          background: rgba(255, 100, 100, 0.4);
          transform: scale(1.1);
        }
        .game-content {
          padding: 20px;
          position: relative;
        }
        .stat-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
          margin-bottom: 12px;
        }
        .stat-box {
          background: rgba(30, 30, 50, 0.6);
          border: 2px solid rgba(100, 100, 150, 0.3);
          padding: 12px;
          position: relative;
          image-rendering: pixelated;
        }
        .stat-box::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 1px;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.1), transparent);
        }
        .stat-label {
          font-family: 'Press Start 2P', cursive;
          font-size: 8px;
          color: #666;
          text-transform: uppercase;
          letter-spacing: 1px;
          margin-bottom: 8px;
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .stat-value {
          font-size: 13px;
          color: #e0e0e0;
          word-break: break-all;
        }
        .stat-value.hash {
          font-family: 'JetBrains Mono', 'Fira Code', monospace;
          font-size: 11px;
        }
        .stat-value a {
          color: #60a5fa;
          text-decoration: none;
          transition: color 0.2s;
        }
        .stat-value a:hover {
          color: #93c5fd;
          text-decoration: underline;
        }
        .stat-value.highlight {
          font-family: 'Press Start 2P', cursive;
          font-size: 12px;
        }
        .stat-box-full {
          grid-column: 1 / -1;
        }
        .type-badge {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 6px 12px;
          background: rgba(${this.hexToRgb(accentColor)}, 0.2);
          border: 2px solid ${accentColor}66;
          font-family: 'Press Start 2P', cursive;
          font-size: 9px;
          color: ${accentColor};
          text-shadow: 0 0 5px ${accentColor}44;
        }
        .explorer-link {
          display: block;
          text-align: center;
          margin-top: 16px;
          padding: 12px 20px;
          background: linear-gradient(180deg, rgba(100, 100, 150, 0.2) 0%, rgba(60, 60, 100, 0.3) 100%);
          border: 2px solid rgba(167, 139, 250, 0.4);
          color: #a78bfa;
          text-decoration: none;
          font-family: 'Press Start 2P', cursive;
          font-size: 9px;
          letter-spacing: 0.5px;
          transition: all 0.2s ease;
          text-shadow: 0 0 5px rgba(167, 139, 250, 0.3);
        }
        .explorer-link:hover {
          background: linear-gradient(180deg, rgba(167, 139, 250, 0.3) 0%, rgba(100, 100, 150, 0.4) 100%);
          border-color: #a78bfa;
          text-shadow: 0 0 10px rgba(167, 139, 250, 0.5);
        }
        .tx-list {
          background: rgba(20, 20, 35, 0.4);
          border: 1px solid rgba(100, 100, 150, 0.2);
          padding: 12px;
          max-height: 150px;
          overflow-y: auto;
          scrollbar-width: none;  /* Firefox */
          -ms-overflow-style: none;  /* IE and Edge */
        }
        .tx-list::-webkit-scrollbar {
          display: none;  /* Chrome, Safari, Opera */
        }
        .tx-list a {
          display: block;
          padding: 4px 0;
          color: #60a5fa;
          text-decoration: none;
          font-family: 'JetBrains Mono', 'Fira Code', monospace;
          font-size: 10px;
          border-bottom: 1px solid rgba(100, 100, 150, 0.1);
          transition: all 0.15s;
        }
        .tx-list a:hover {
          color: #93c5fd;
          padding-left: 8px;
        }
        .tx-list-more {
          color: #666;
          font-size: 10px;
          padding-top: 8px;
          font-style: italic;
        }
        .empty-state {
          color: #555;
          font-size: 11px;
          text-align: center;
          padding: 12px;
          font-style: italic;
        }
      </style>
      <div class="game-panel">
        <div class="pixel-corner-tl"></div>
        <div class="pixel-corner-tr"></div>
        <div class="pixel-corner-bl"></div>
        <div class="pixel-corner-br"></div>
        <div class="game-header">
          <div class="game-title">${icon}${title}</div>
          <button class="game-close" id="close-popup">×</button>
        </div>
        <div class="game-content" id="popup-content">
    `;
  }

  private hexToRgb(hex: string): string {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result 
      ? `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}}`
      : '255, 255, 255';
  }

  showBlock(block: BlockInfo): void {
    this.currentType = 'block';
    const accentColor = '#fbbf24';
    
    const txList = block.transactions.length > 0
      ? block.transactions.slice(0, 5).map(tx => `
          <a href="${this.explorerBaseUrl}/tx/${tx}" target="_blank">
            ${this.formatHash(tx)}
          </a>
        `).join('') + 
        (block.transactions.length > 5 ? `<div class="tx-list-more">+${block.transactions.length - 5} more transactions</div>` : '')
      : '<div class="empty-state">No transactions in this block</div>';

    this.container.innerHTML = `
      ${this.createGameFrame(`BLOCK #${block.number.toLocaleString()}`, BLOCK_ICON, accentColor)}
        <div class="stat-row">
          <div class="stat-box stat-box-full">
            <div class="stat-label">Hash</div>
            <div class="stat-value hash">
              <a href="${this.explorerBaseUrl}/block/${block.number}" target="_blank">${block.hash}</a>
            </div>
          </div>
        </div>
        
        <div class="stat-row">
          <div class="stat-box">
            <div class="stat-label">Timestamp</div>
            <div class="stat-value">${this.formatTimestamp(block.timestamp)}</div>
          </div>
          <div class="stat-box">
            <div class="stat-label">Transactions</div>
            <div class="stat-value highlight" style="color: #34d399;">${block.transactions.length}</div>
          </div>
        </div>
        
        <div class="stat-row">
          <div class="stat-box">
            <div class="stat-label">Gas Used</div>
            <div class="stat-value">${this.formatGas(block.gasUsed)}</div>
          </div>
          <div class="stat-box">
            <div class="stat-label">Gas Limit</div>
            <div class="stat-value">${this.formatGas(block.gasLimit)}</div>
          </div>
        </div>
        
        <div class="stat-row">
          <div class="stat-box stat-box-full">
            <div class="stat-label">Included Transactions</div>
            <div class="tx-list">${txList}</div>
          </div>
        </div>
        
        <a href="${this.explorerBaseUrl}/block/${block.number}" target="_blank" class="explorer-link">
          View on Explorer
        </a>
      </div>
    `;

    this.attachCloseHandler();
    this.show();
  }

  showTransaction(tx: TransactionInfo): void {
    this.currentType = 'transaction';
    
    const typeConfig: { [key: string]: { color: string; label: string } } = {
      transfer: { color: '#60a5fa', label: 'Native Transfer' },
      token: { color: '#34d399', label: 'Token Transfer' },
      contract: { color: '#f472b6', label: 'Contract Call' },
      inference: { color: '#a78bfa', label: 'Proof of Inference' }
    };
    
    const config = typeConfig[tx.type] || { color: '#60a5fa', label: tx.type };
    const icon = TRANSACTION_ICONS[tx.type] || TRANSACTION_ICONS.transfer;

    const valueWei = BigInt(tx.value);
    const valueWARD = Number(valueWei) / 1e18;

    let valueDisplay: string;
    if (valueWei === 0n) {
      valueDisplay = '0 WARD';
    } else if (valueWARD >= 0.000001) {
      // Show WARD for amounts >= 1 uWARD (microWARD)
      valueDisplay = `${valueWARD.toFixed(6)} WARD`;
    } else {
      // Show uWARD for small amounts to avoid "0.000000 WARD"
      const valueuWARD = Number(valueWei) / 1e12; // Convert weiWARD to microWARD
      valueDisplay = `${valueuWARD.toFixed(2)} uWARD`;
    }

    const gasPriceGwei = tx.gasPrice ? (Number(BigInt(tx.gasPrice)) / 1e9).toFixed(2) : '0';

    this.container.innerHTML = `
      ${this.createGameFrame(config.label.toUpperCase(), icon, config.color)}
        <div class="stat-row">
          <div class="stat-box stat-box-full">
            <div class="stat-label">Transaction Hash</div>
            <div class="stat-value hash">
              <a href="${this.explorerBaseUrl}/tx/${tx.hash}" target="_blank">${tx.hash}</a>
            </div>
          </div>
        </div>
        
        <div class="stat-row">
          <div class="stat-box">
            <div class="stat-label">Type</div>
            <div class="type-badge" style="color: ${config.color}; border-color: ${config.color}66; background: rgba(${this.hexToRgb(config.color)}, 0.15);">
              ${icon}${config.label}
            </div>
          </div>
          <div class="stat-box">
            <div class="stat-label">Block</div>
            <div class="stat-value highlight">
              <a href="${this.explorerBaseUrl}/block/${tx.blockNumber}" target="_blank" style="color: #fbbf24;">
                #${tx.blockNumber.toLocaleString()}
              </a>
            </div>
          </div>
        </div>
        
        <div class="stat-row">
          <div class="stat-box stat-box-full">
            <div class="stat-label">From</div>
            <div class="stat-value hash">
              <a href="${this.explorerBaseUrl}/address/${tx.from}" target="_blank">${tx.from}</a>
            </div>
          </div>
        </div>
        
        <div class="stat-row">
          <div class="stat-box stat-box-full">
            <div class="stat-label">${tx.to ? 'To' : 'Contract Creation'}</div>
            ${tx.to ? `
              <div class="stat-value hash">
                <a href="${this.explorerBaseUrl}/address/${tx.to}" target="_blank">${tx.to}</a>
              </div>
            ` : `
              <div class="stat-value" style="color: #f472b6; font-family: 'Press Start 2P', cursive; font-size: 10px;">
                New Contract Deployed
              </div>
            `}
          </div>
        </div>
        
        <div class="stat-row">
          <div class="stat-box">
            <div class="stat-label">Value</div>
            <div class="stat-value highlight" style="color: #34d399;">${valueDisplay}</div>
          </div>
          <div class="stat-box">
            <div class="stat-label">Gas Price</div>
            <div class="stat-value">${gasPriceGwei} Gwei</div>
          </div>
        </div>
        
        <a href="${this.explorerBaseUrl}/tx/${tx.hash}" target="_blank" class="explorer-link">
          View on Explorer
        </a>
      </div>
    `;

    this.attachCloseHandler();
    this.show();
  }

  private attachCloseHandler(): void {
    const closeBtn = document.getElementById('close-popup');
    if (closeBtn) {
      closeBtn.onclick = () => this.hide();
    }
  }

  private startParticles(): void {
    if (this.particleCanvas) return;
    
    // Create particle canvas behind the popup
    this.particleCanvas = document.createElement('canvas');
    this.particleCanvas.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      pointer-events: none;
      z-index: 998;
    `;
    this.particleCanvas.width = window.innerWidth;
    this.particleCanvas.height = window.innerHeight;
    document.body.insertBefore(this.particleCanvas, this.overlay);
    
    this.particleCtx = this.particleCanvas.getContext('2d');
    
    // Initialize particles around the popup center
    const centerX = window.innerWidth / 2;
    const centerY = window.innerHeight / 2;
    
    for (let i = 0; i < 30; i++) {
      const angle = Math.random() * Math.PI * 2;
      const distance = 200 + Math.random() * 150;
      this.particles.push({
        x: centerX + Math.cos(angle) * distance,
        y: centerY + Math.sin(angle) * distance,
        vx: (Math.random() - 0.5) * 0.5,
        vy: (Math.random() - 0.5) * 0.5 - 0.3,
        life: 1,
        size: 1 + Math.random() * 2,
        color: this.currentType === 'block' ? '#fbbf24' : '#a78bfa'
      });
    }
    
    this.animateParticles();
  }

  private animateParticles(): void {
    if (!this.particleCanvas || !this.particleCtx) return;
    
    this.particleCtx.clearRect(0, 0, this.particleCanvas.width, this.particleCanvas.height);
    
    // Update and draw particles
    this.particles = this.particles.filter(p => {
      p.x += p.vx;
      p.y += p.vy;
      p.life -= 0.005;
      
      if (p.life <= 0) {
        // Respawn particle
        const centerX = window.innerWidth / 2;
        const centerY = window.innerHeight / 2;
        const angle = Math.random() * Math.PI * 2;
        const distance = 200 + Math.random() * 150;
        p.x = centerX + Math.cos(angle) * distance;
        p.y = centerY + Math.sin(angle) * distance;
        p.life = 1;
      }
      
      // Draw pixel particle
      this.particleCtx!.fillStyle = p.color + Math.floor(p.life * 100).toString(16).padStart(2, '0');
      this.particleCtx!.fillRect(Math.floor(p.x), Math.floor(p.y), p.size, p.size);
      
      return true;
    });
    
    if (this.isVisible) {
      this.animationFrame = requestAnimationFrame(() => this.animateParticles());
    }
  }

  private stopParticles(): void {
    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame);
      this.animationFrame = null;
    }
    if (this.particleCanvas && this.particleCanvas.parentNode) {
      this.particleCanvas.parentNode.removeChild(this.particleCanvas);
      this.particleCanvas = null;
      this.particleCtx = null;
    }
    this.particles = [];
  }

  private show(): void {
    this.overlay.style.display = 'block';
    this.container.style.display = 'block';
    
    // Trigger reflow for animation
    this.container.offsetHeight;
    
    // Animate in
    requestAnimationFrame(() => {
      this.overlay.style.opacity = '1';
      this.container.style.opacity = '1';
      this.container.style.transform = 'translate(-50%, -50%) scale(1)';
    });
    
    this.isVisible = true;
    this.startParticles();
  }

  hide(): void {
    this.overlay.style.opacity = '0';
    this.container.style.opacity = '0';
    this.container.style.transform = 'translate(-50%, -50%) scale(0.9)';
    
    setTimeout(() => {
      this.overlay.style.display = 'none';
      this.container.style.display = 'none';
    }, 200);
    
    this.isVisible = false;
    this.currentType = null;
    this.stopParticles();
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
    const legendData: { [key: string]: { title: string; color: string; icon: string; description: string } } = {
      block: {
        title: 'Block',
        color: '#fbbf24',
        icon: BLOCK_ICON,
        description: 'A block is a collection of transactions on the Warden blockchain. Blocks appear as glowing golden stars or planets. Size reflects transaction count. Click any block for details.'
      },
      transaction: {
        title: 'Transaction',
        color: '#a78bfa',
        icon: TRANSACTION_ICONS.transfer,
        description: 'Transactions are actions on the blockchain - sending tokens, calling contracts, etc. They appear as violet comets with particle trails across the universe.'
      },
      token: {
        title: 'Token Transfer',
        color: '#34d399',
        icon: TRANSACTION_ICONS.token,
        description: 'Token transfers move tokens between addresses. Bright green comets with intense sparkle effects and larger particle trails, representing value flowing through the network.'
      },
      contract: {
        title: 'Contract Call',
        color: '#f472b6',
        icon: TRANSACTION_ICONS.contract,
        description: 'Contract calls interact with smart contracts. Pink comets with plasma and lightning effects, representing computational energy of decentralized applications.'
      },
      inference: {
        title: 'Proof of Inference',
        color: '#a78bfa',
        icon: TRANSACTION_ICONS.inference,
        description: 'AI inference transactions with star-like effects, representing on-chain AI computations on the Warden network.'
      }
    };

    const info = legendData[type];
    if (!info) return;

    this.currentType = type === 'block' ? 'block' : 'transaction';
    
    this.container.innerHTML = `
      ${this.createGameFrame(info.title.toUpperCase(), info.icon, info.color)}
        <div style="color: #c0c0c0; font-size: 13px; line-height: 1.7; padding: 8px 0;">
          ${info.description}
        </div>
      </div>
    `;

    this.attachCloseHandler();
    this.show();
  }

  destroy(): void {
    this.stopParticles();
    if (this.overlay.parentNode) {
      this.overlay.parentNode.removeChild(this.overlay);
    }
    if (this.container.parentNode) {
      this.container.parentNode.removeChild(this.container);
    }
  }
}