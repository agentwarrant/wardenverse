/**
 * TxHashScroll - Displays a scroll of recent transaction hashes
 * Bottom right corner, fading from top (most recent) to bottom
 * Click on a hash to see transaction details
 */

import type { Transaction } from '../data/BlockchainDataSource';
import { InfoPopup } from './InfoPopup';

export interface TxHashEntry {
  hash: string;
  type: 'transfer' | 'contract' | 'token' | 'inference';
  timestamp: number;
  blockNumber: number;
  from: string;
  to: string | null;
  value: string;
  gasPrice: string;
}

export class TxHashScroll {
  private container: HTMLDivElement;
  private maxEntries: number = 10;
  private entries: TxHashEntry[] = [];
  private infoPopup: InfoPopup;
  
  constructor(infoPopup: InfoPopup) {
    this.infoPopup = infoPopup;
    this.container = document.createElement('div');
    this.container.id = 'tx-hash-scroll';
    this.container.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      font-family: 'SF Mono', 'Monaco', 'Inconsolata', 'Roboto Mono', monospace;
      font-size: 20px;
      text-align: right;
      pointer-events: auto;
      z-index: 50;
      line-height: 1.5;
    `;
    
    document.body.appendChild(this.container);
  }
  
  addTransaction(tx: Transaction): void {
    // Add new entry at the beginning (most recent)
    this.entries.unshift({
      hash: tx.hash,
      type: tx.type,
      timestamp: Date.now(),
      blockNumber: tx.blockNumber,
      from: tx.from,
      to: tx.to,
      value: tx.value,
      gasPrice: tx.gasPrice
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
        transition: opacity 0.3s ease, transform 0.2s ease;
        text-shadow: 0 0 8px ${color}40;
        cursor: pointer;
        pointer-events: auto;
      `;
      
      div.textContent = this.formatHash(entry.hash);
      
      // Add hover effect
      div.onmouseenter = () => {
        div.style.transform = 'translateX(-4px)';
        div.style.opacity = '1';
      };
      div.onmouseleave = () => {
        div.style.transform = 'translateX(0)';
        div.style.opacity = String(opacity);
      };
      
      // Click to show transaction details
      div.onclick = (e) => {
        e.stopPropagation();
        this.infoPopup.showTransaction({
          hash: entry.hash,
          blockNumber: entry.blockNumber,
          from: entry.from,
          to: entry.to,
          value: entry.value,
          gasPrice: entry.gasPrice,
          type: entry.type
        });
      };
      
      this.container.appendChild(div);
    });
  }
  
  destroy(): void {
    if (this.container.parentNode) {
      this.container.parentNode.removeChild(this.container);
    }
  }
  
  /**
   * Clear all transaction entries.
   */
  clear(): void {
    this.entries = [];
    this.render();
  }
}