/**
 * TxHashScroll - Displays a scroll of recent transaction hashes
 * Bottom right corner, fading from top (most recent) to bottom
 */

export interface TxHashEntry {
  hash: string;
  type: 'transfer' | 'contract' | 'token' | 'inference';
  timestamp: number;
}

export class TxHashScroll {
  private container: HTMLDivElement;
  private maxEntries: number = 10;
  private entries: TxHashEntry[] = [];
  
  constructor() {
    this.container = document.createElement('div');
    this.container.id = 'tx-hash-scroll';
    this.container.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      font-family: 'SF Mono', 'Monaco', 'Inconsolata', 'Roboto Mono', monospace;
      font-size: 10px;
      text-align: right;
      pointer-events: none;
      z-index: 50;
      line-height: 1.6;
    `;
    
    document.body.appendChild(this.container);
  }
  
  addTransaction(hash: string, type: 'transfer' | 'contract' | 'token' | 'inference'): void {
    // Add new entry at the beginning (most recent)
    this.entries.unshift({
      hash,
      type,
      timestamp: Date.now()
    });
    
    // Keep only the last maxEntries
    if (this.entries.length > this.maxEntries) {
      this.entries.pop();
    }
    
    this.render();
  }
  
  private getTypeColor(type: string): string {
    switch(type) {
      case 'token':
        return '#34d399'; // green
      case 'contract':
        return '#f472b6'; // pink
      case 'inference':
        return '#a78bfa'; // purple
      default:
        return '#60a5fa'; // blue
    }
  }
  
  private formatHash(hash: string): string {
    // Show first 6 and last 4 characters
    if (hash.length <= 12) return hash;
    return `${hash.slice(0, 6)}…${hash.slice(-4)}`;
  }
  
  private render(): void {
    this.container.innerHTML = '';
    
    this.entries.forEach((entry, index) => {
      const div = document.createElement('div');
      
      // Calculate opacity: top entry is 1.0, bottom fades to 0.15
      const opacity = 1 - (index / (this.maxEntries - 1)) * 0.85;
      
      const color = this.getTypeColor(entry.type);
      
      div.style.cssText = `
        color: ${color};
        opacity: ${opacity};
        transition: opacity 0.3s ease;
        text-shadow: 0 0 8px ${color}40;
      `;
      
      div.textContent = this.formatHash(entry.hash);
      this.container.appendChild(div);
    });
  }
  
  destroy(): void {
    if (this.container.parentNode) {
      this.container.parentNode.removeChild(this.container);
    }
  }
}