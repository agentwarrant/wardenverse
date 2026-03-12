/**
 * TxHashScroll - Displays a scroll of recent transaction hashes
 * Pixel-art sci-fi terminal aesthetic for the Wardenverse
 * Features: slide-in animations, glow pulses, type icons, terminal frame
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
  isNew: boolean; // Track new entries for animation
}

// Pixel-art sprite SVGs for transaction types
const TYPE_SPRITES = {
  transfer: `<svg width="16" height="16" viewBox="0 0 8 8" style="image-rendering: pixelated;"><rect x="1" y="3" width="2" height="2" fill="#60a5fa"/><rect x="5" y="2" width="2" height="2" fill="#60a5fa"/><rect x="3" y="3" width="2" height="1" fill="#93c5fd"/></svg>`,
  
  token: `<svg width="16" height="16" viewBox="0 0 8 8" style="image-rendering: pixelated;"><rect x="2" y="1" width="4" height="1" fill="#10b981"/><rect x="1" y="2" width="1" height="1" fill="#10b981"/><rect x="2" y="2" width="4" height="1" fill="#34d399"/><rect x="6" y="2" width="1" height="1" fill="#059669"/><rect x="2" y="3" width="2" height="1" fill="#6ee7b7"/><rect x="4" y="3" width="2" height="1" fill="#34d399"/><rect x="2" y="4" width="4" height="1" fill="#34d399"/><rect x="2" y="5" width="4" height="1" fill="#10b981"/></svg>`,
  
  contract: `<svg width="16" height="16" viewBox="0 0 8 8" style="image-rendering: pixelated;"><rect x="3" y="0" width="2" height="1" fill="#f472b6"/><rect x="2" y="1" width="1" height="1" fill="#f472b6"/><rect x="3" y="1" width="2" height="1" fill="#ec4899"/><rect x="5" y="1" width="1" height="1" fill="#f472b6"/><rect x="2" y="2" width="4" height="1" fill="#f9a8d4"/><rect x="3" y="3" width="2" height="1" fill="#ffffff"/><rect x="2" y="4" width="4" height="1" fill="#f9a8d4"/><rect x="3" y="5" width="2" height="1" fill="#ec4899"/></svg>`,
  
  inference: `<svg width="16" height="16" viewBox="0 0 8 8" style="image-rendering: pixelated;"><rect x="3" y="0" width="2" height="1" fill="#a78bfa"/><rect x="2" y="1" width="4" height="1" fill="#c4b5fd"/><rect x="1" y="2" width="6" height="1" fill="#a78bfa"/><rect x="2" y="3" width="4" height="1" fill="#ddd6fe"/><rect x="1" y="4" width="6" height="1" fill="#a78bfa"/><rect x="2" y="5" width="4" height="1" fill="#c4b5fd"/><rect x="3" y="6" width="2" height="1" fill="#a78bfa"/></svg>`
};

export class TxHashScroll {
  private container: HTMLDivElement;
  private frame: HTMLDivElement; // Pixel-art frame container
  private header: HTMLDivElement; // Terminal header
  private content: HTMLDivElement; // Scrollable content area
  private maxEntries: number = 8;
  private entries: TxHashEntry[] = [];
  private infoPopup: InfoPopup;
  
  constructor(infoPopup: InfoPopup) {
    this.infoPopup = infoPopup;
    
    // Create main container
    this.container = document.createElement('div');
    this.container.id = 'tx-hash-scroll-container';
    this.container.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      z-index: 50;
      pointer-events: auto;
    `;
    
    // Create pixel-art frame
    this.frame = document.createElement('div');
    this.frame.id = 'tx-hash-scroll-frame';
    this.frame.style.cssText = `
      background: linear-gradient(180deg, rgba(15, 15, 25, 0.97) 0%, rgba(10, 10, 20, 0.98) 100%);
      padding: 0;
      border-radius: 0;
      box-shadow: 
        0 0 0 2px rgba(96, 165, 250, 0.6),
        0 0 0 4px rgba(10, 10, 20, 1),
        0 0 0 6px rgba(167, 139, 250, 0.4),
        0 0 20px rgba(96, 165, 250, 0.3),
        0 0 40px rgba(167, 139, 250, 0.15),
        inset 0 0 30px rgba(96, 165, 250, 0.05);
      overflow: hidden;
      animation: terminal-glow 3s ease-in-out infinite;
    `;
    
    // Create terminal header
    this.header = document.createElement('div');
    this.header.id = 'tx-hash-scroll-header';
    this.header.innerHTML = `
      <span class="terminal-dot" style="background: #ef4444;"></span>
      <span class="terminal-dot" style="background: #fbbf24;"></span>
      <span class="terminal-dot" style="background: #34d399;"></span>
      <span class="terminal-title">TX FEED</span>
    `;
    this.header.style.cssText = `
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 8px 12px;
      background: linear-gradient(180deg, rgba(30, 30, 50, 0.9) 0%, rgba(20, 20, 35, 0.95) 100%);
      border-bottom: 1px solid rgba(96, 165, 250, 0.3);
      font-family: 'Press Start 2P', monospace;
    `;
    
    // Add styles for header elements
    const headerStyle = document.createElement('style');
    headerStyle.textContent = `
      #tx-hash-scroll-header .terminal-dot {
        width: 8px;
        height: 8px;
        border-radius: 0; /* Square for pixel art */
        box-shadow: 0 0 4px currentColor;
      }
      #tx-hash-scroll-header .terminal-title {
        font-size: 8px;
        color: #a78bfa;
        margin-left: 8px;
        text-shadow: 0 0 10px rgba(167, 139, 250, 0.5);
        letter-spacing: 1px;
      }
      @keyframes terminal-glow {
        0%, 100% {
          box-shadow: 
            0 0 0 2px rgba(96, 165, 250, 0.6),
            0 0 0 4px rgba(10, 10, 20, 1),
            0 0 0 6px rgba(167, 139, 250, 0.4),
            0 0 20px rgba(96, 165, 250, 0.3),
            0 0 40px rgba(167, 139, 250, 0.15),
            inset 0 0 30px rgba(96, 165, 250, 0.05);
        }
        50% {
          box-shadow: 
            0 0 0 2px rgba(96, 165, 250, 0.8),
            0 0 0 4px rgba(10, 10, 20, 1),
            0 0 0 6px rgba(167, 139, 250, 0.6),
            0 0 30px rgba(96, 165, 250, 0.4),
            0 0 60px rgba(167, 139, 250, 0.2),
            inset 0 0 40px rgba(96, 165, 250, 0.08);
        }
      }
      @keyframes slide-in-right {
        from {
          transform: translateX(100%);
          opacity: 0;
        }
        to {
          transform: translateX(0);
          opacity: 1;
        }
      }
      @keyframes glow-pulse {
        0%, 100% {
          filter: brightness(1);
          box-shadow: 0 0 8px var(--glow-color);
        }
        50% {
          filter: brightness(1.3);
          box-shadow: 0 0 20px var(--glow-color), 0 0 30px var(--glow-color);
        }
      }
      @keyframes scanline {
        0% { transform: translateY(-100%); }
        100% { transform: translateY(100%); }
      }
    `;
    document.head.appendChild(headerStyle);
    
    // Create scrollable content area
    this.content = document.createElement('div');
    this.content.id = 'tx-hash-scroll-content';
    this.content.style.cssText = `
      padding: 8px;
      min-height: 120px;
      max-height: 240px;
      overflow-y: auto;
      scrollbar-width: none;  /* Firefox */
      -ms-overflow-style: none;  /* IE and Edge */
      position: relative;
    `;
    // Add webkit scrollbar hide for Chrome/Safari/Opera
    const scrollbarStyle = document.createElement('style');
    scrollbarStyle.textContent = `
      #tx-hash-scroll-content::-webkit-scrollbar {
        display: none;
      }
    `;
    document.head.appendChild(scrollbarStyle);
    
    // Add scanline effect overlay
    const scanline = document.createElement('div');
    scanline.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 4px;
      background: linear-gradient(180deg, 
        transparent 0%, 
        rgba(96, 165, 250, 0.1) 50%, 
        transparent 100%);
      pointer-events: none;
      animation: scanline 4s linear infinite;
      opacity: 0.5;
    `;
    
    // Assemble the frame
    this.frame.appendChild(this.header);
    this.frame.appendChild(this.content);
    this.content.appendChild(scanline);
    this.container.appendChild(this.frame);
    
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
      gasPrice: tx.gasPrice,
      isNew: true // Mark as new for animation
    });
    
    // Mark all other entries as not new
    for (let i = 1; i < this.entries.length; i++) {
      this.entries[i].isNew = false;
    }
    
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
  
  private getTypeGlow(type: string): string {
    switch(type) {
      case 'token':
        return 'rgba(52, 211, 153, 0.6)';
      case 'contract':
        return 'rgba(244, 114, 182, 0.6)';
      case 'inference':
        return 'rgba(167, 139, 250, 0.6)';
      default:
        return 'rgba(96, 165, 250, 0.6)';
    }
  }
  
  private formatHash(hash: string): string {
    // Show first 6 and last 4 characters
    if (hash.length <= 12) return hash;
    return `${hash.slice(0, 6)}…${hash.slice(-4)}`;
  }
  
  private render(): void {
    // Clear content but keep scanline
    const scanline = this.content.querySelector('div');
    this.content.innerHTML = '';
    if (scanline) this.content.appendChild(scanline);
    
    this.entries.forEach((entry, index) => {
      const div = document.createElement('div');
      div.className = 'tx-hash-entry';
      
      // Calculate opacity: top entry is 1.0, bottom fades to 0.3
      const opacity = Math.max(0.3, 1 - (index / this.maxEntries) * 0.7);
      const color = this.getTypeColor(entry.type);
      const glowColor = this.getTypeGlow(entry.type);
      
      div.style.cssText = `
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 6px 4px;
        font-family: 'Press Start 2P', monospace;
        font-size: 9px;
        color: ${color};
        opacity: ${opacity};
        cursor: pointer;
        border-left: 2px solid transparent;
        transition: all 0.15s ease;
        position: relative;
        --glow-color: ${glowColor};
        ${entry.isNew ? 'animation: slide-in-right 0.3s ease-out, glow-pulse 1s ease-in-out 2;' : ''}
      `;
      
      // Type icon sprite
      const iconContainer = document.createElement('div');
      iconContainer.className = 'tx-type-icon';
      iconContainer.style.cssText = `
        width: 16px;
        height: 16px;
        flex-shrink: 0;
        filter: drop-shadow(0 0 4px ${glowColor});
        ${entry.isNew ? 'animation: glow-pulse 1s ease-in-out 2;' : ''}
      `;
      iconContainer.innerHTML = TYPE_SPRITES[entry.type] || TYPE_SPRITES.transfer;
      
      // Hash text
      const hashText = document.createElement('span');
      hashText.className = 'tx-hash-text';
      hashText.textContent = this.formatHash(entry.hash);
      hashText.style.cssText = `
        flex: 1;
        text-align: right;
        text-shadow: 0 0 8px ${glowColor};
        letter-spacing: 0.5px;
      `;
      
      div.appendChild(iconContainer);
      div.appendChild(hashText);
      
      // Hover effects
      div.onmouseenter = () => {
        div.style.background = `linear-gradient(90deg, transparent 0%, ${glowColor.replace('0.6', '0.15')} 50%, transparent 100%)`;
        div.style.borderLeftColor = color;
        div.style.opacity = '1';
        div.style.transform = 'translateX(-2px)';
      };
      div.onmouseleave = () => {
        div.style.background = 'transparent';
        div.style.borderLeftColor = 'transparent';
        div.style.opacity = String(opacity);
        div.style.transform = 'translateX(0)';
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
      
      this.content.appendChild(div);
    });
    
    // Add empty state if no entries
    if (this.entries.length === 0) {
      const empty = document.createElement('div');
      empty.style.cssText = `
        padding: 20px;
        text-align: center;
        font-family: 'Press Start 2P', monospace;
        font-size: 8px;
        color: #4b5563;
        letter-spacing: 0.5px;
      `;
      empty.textContent = 'AWAITING TX...';
      this.content.appendChild(empty);
    }
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