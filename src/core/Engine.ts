/**
 * Core rendering engine with Noita-style pixel physics simulation
 * Uses WebWorker for off-main-thread physics computation
 * PIXEL_SIZE = 4 for performance (each game pixel is 4x4 screen pixels)
 */

import { PixelWorld } from './PixelWorld';
import { PixelType } from './PixelTypes';
import { BlockVisual } from '../visuals/BlockVisual';
import { TransactionVisual } from '../visuals/TransactionVisual';
import { InfoPopup, BlockInfo, TransactionInfo } from '../ui/InfoPopup';

export interface Block {
  number: number;
  hash: string;
  timestamp: number;
  transactions: string[];
  gasUsed: string;
  gasLimit: string;
  parentHash?: string;
}

export interface Transaction {
  hash: string;
  blockNumber: number;
  from: string;
  to: string | null;
  value: string;
  gasPrice: string;
  type: 'transfer' | 'contract' | 'token' | 'inference';
}

export class Engine {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private world: PixelWorld;
  private running: boolean = false;
  private lastTime: number = 0;
  private blocks: Map<number, BlockVisual> = new Map();
  private pendingTransactions: TransactionVisual[] = [];
  private mouseX: number = 0;
  private mouseY: number = 0;
  private blockCountElement: HTMLElement | null;
  private txCountElement: HTMLElement | null;
  private time: number = 0;
  private ambientParticleTimer: number = 0;
  private screenWidth: number = 800;
  private screenHeight: number = 600;
  private initialized: boolean = false;
  private infoPopup: InfoPopup;
  private onBlockClick: ((block: Block) => void) | null = null;
  private onBackgroundClick: (() => void) | null = null;
  private isResizing: boolean = false;
  private resizeTimeout: ReturnType<typeof setTimeout> | null = null;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Could not get 2D context');
    this.ctx = ctx;
    // Will be properly sized in setupCanvas()
    this.world = new PixelWorld(800, 600);
    this.blockCountElement = document.getElementById('block-count');
    this.txCountElement = document.getElementById('tx-count');
    
    this.setupCanvas();
    this.infoPopup = new InfoPopup();
    this.setupEventListeners();
    this.initialized = true;
  }

  private setupCanvas(): void {
    const resize = () => {
      // Mark as resizing to pause rendering
      this.isResizing = true;
      
      // Clear any pending resize timeout
      if (this.resizeTimeout) {
        clearTimeout(this.resizeTimeout);
      }
      
      const dpr = window.devicePixelRatio || 1;
      const rect = this.canvas.getBoundingClientRect();
      
      // Ensure we have valid dimensions - use window size as fallback
      let width = Math.max(100, rect.width);
      let height = Math.max(100, rect.height);
      
      // Fallback to window dimensions if canvas rect is too small
      if (width < 100 || height < 100) {
        width = Math.max(100, window.innerWidth);
        height = Math.max(100, window.innerHeight - 60); // Account for header
      }
      
      // Store actual screen dimensions BEFORE changing canvas size
      // This ensures render() uses the new dimensions immediately
      this.screenWidth = width;
      this.screenHeight = height;
      
      // CRITICAL: Set canvas style dimensions EXPLICITLY to prevent browser auto-scaling
      // This is the key fix - CSS width:100%/height:100% causes browser to scale content
      // during resize, creating artifacts. By setting explicit pixel dimensions, we prevent this.
      this.canvas.style.width = width + 'px';
      this.canvas.style.height = height + 'px';
      
      // Set canvas buffer size (for sharp rendering)
      // This CLEARS the canvas, so we must fill immediately after
      this.canvas.width = width * dpr;
      this.canvas.height = height * dpr;
      
      // Reset transform and scale for CSS pixels
      this.ctx.setTransform(1, 0, 0, 1, 0, 0);
      this.ctx.scale(dpr, dpr);
      
      // CRITICAL: Fill with background IMMEDIATELY after resize
      // This must happen before any render() call to prevent white traces
      this.ctx.fillStyle = '#0a0a12';
      this.ctx.fillRect(0, 0, width, height);
      
      // Update world with actual screen dimensions
      this.world.resize(width, height);
      
      // Update existing entities with new dimensions
      this.updateEntityDimensions();
      
      // Debounce the resize end - only mark as complete after a short delay
      // This prevents flickering during continuous resize
      this.resizeTimeout = setTimeout(() => {
        this.isResizing = false;
        console.log(`Canvas resize complete: ${width}x${height} (DPR: ${dpr})`);
      }, 50);
    };
    
    // Force layout reflow before getting dimensions
    // This ensures the flexbox has calculated the container size
    void this.canvas.offsetHeight;
    void this.canvas.clientWidth;
    void this.canvas.clientHeight;
    
    // Initial resize - try immediately
    resize();
    
    // Also trigger resize after next frame to catch any late layout changes
    requestAnimationFrame(() => {
      void this.canvas.offsetHeight; // Force reflow
      resize();
    });
    
    // And again after a short delay for fonts/images
    setTimeout(resize, 100);
    setTimeout(resize, 500); // Extra attempt for slow layouts
    
    // Handle window resize
    window.addEventListener('resize', resize);
    
    // Also handle resize after fonts/images load (can affect layout)
    if (document.readyState === 'complete') {
      // Page already loaded, just do one more resize check
      setTimeout(resize, 100);
    } else {
      window.addEventListener('load', () => {
        resize();
        // And once more after load
        setTimeout(resize, 200);
      });
    }
  }

  private updateEntityDimensions(): void {
    // Update all entities with new screen dimensions
    for (const block of this.blocks.values()) {
      block.updateScreenDimensions(this.screenWidth, this.screenHeight);
    }
    for (const tx of this.pendingTransactions) {
      tx.updateScreenDimensions(this.screenWidth, this.screenHeight);
    }
  }

  private setupEventListeners(): void {
    this.canvas.addEventListener('mousemove', (e) => {
      const rect = this.canvas.getBoundingClientRect();
      this.mouseX = e.clientX - rect.left;
      this.mouseY = e.clientY - rect.top;
    });
    
    // Click to check for block hits or add particles
    this.canvas.addEventListener('click', (e) => {
      const rect = this.canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      // Check if click is on a block
      for (const block of this.blocks.values()) {
        if (block.containsPoint(x, y)) {
          const blockData = block.getBlock();
          this.infoPopup.showBlock({
            number: blockData.number,
            hash: blockData.hash,
            timestamp: blockData.timestamp,
            transactions: blockData.transactions,
            gasUsed: blockData.gasUsed,
            gasLimit: blockData.gasLimit,
            parentHash: blockData.parentHash || ''
          });
          if (this.onBlockClick) {
            this.onBlockClick(blockData);
          }
          return; // Don't create explosion if we hit a block
        }
      }

      // Check if click is on a transaction (smaller hit area)
      for (const tx of this.pendingTransactions) {
        const pos = tx.getPosition();
        const dx = x - pos.x;
        const dy = y - pos.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        if (distance <= 20) { // 20px hit radius for transactions
          const txData = tx.getTransaction();
          this.infoPopup.showTransaction({
            hash: txData.hash,
            blockNumber: txData.blockNumber,
            from: txData.from,
            to: txData.to,
            value: txData.value,
            gasPrice: txData.gasPrice,
            type: txData.type
          });
          return;
        }
      }
      
      // No hit - create explosion as before
      this.world.createExplosion(x, y, 40, 2);
      
      // Notify background click
      if (this.onBackgroundClick) {
        this.onBackgroundClick();
      }
      
      for (let i = 0; i < 30; i++) {
        const px = x + (Math.random() - 0.5) * 60;
        const py = y + (Math.random() - 0.5) * 60;
        const types = [
          PixelType.FIRE, PixelType.GAS, PixelType.EXPLOSION, 
          PixelType.ENERGY, PixelType.PLASMA, PixelType.SPARK
        ];
        const type = types[Math.floor(Math.random() * types.length)];
        this.world.setPixelScreen(px, py, type);
      }
    });
    
    // Right-click for lightning
    this.canvas.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      const rect = this.canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      
      for (let i = 0; i < 15; i++) {
        const lx = x + (Math.random() - 0.5) * 100;
        const ly = y + (Math.random() - 0.5) * 100;
        this.world.setPixelScreen(lx, ly, PixelType.LIGHTNING);
      }
      
      for (let i = 0; i < 20; i++) {
        const angle = Math.random() * Math.PI * 2;
        const dist = Math.random() * 50;
        const ex = x + Math.cos(angle) * dist;
        const ey = y + Math.sin(angle) * dist;
        this.world.setPixelScreen(ex, ey, PixelType.ELECTRIC);
      }
    });
    
    // Mouse drag for particle spray
    let isDragging = false;
    let lastDragX = 0;
    let lastDragY = 0;
    
    this.canvas.addEventListener('mousedown', (e) => {
      if (e.button === 0) {
        isDragging = true;
        lastDragX = e.clientX - this.canvas.getBoundingClientRect().left;
        lastDragY = e.clientY - this.canvas.getBoundingClientRect().top;
      }
    });
    
    this.canvas.addEventListener('mouseup', () => {
      isDragging = false;
    });
    
    this.canvas.addEventListener('mouseleave', () => {
      isDragging = false;
    });
    
    this.canvas.addEventListener('mousemove', (e) => {
      if (isDragging) {
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        const dx = x - lastDragX;
        const dy = y - lastDragY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const steps = Math.max(1, Math.floor(dist / 8));
        
        for (let i = 0; i < steps; i++) {
          const t = i / steps;
          const px = lastDragX + dx * t + (Math.random() - 0.5) * 10;
          const py = lastDragY + dy * t + (Math.random() - 0.5) * 10;
          
          const types = [
            PixelType.FIRE, PixelType.SPARK, PixelType.PLASMA,
            PixelType.ENERGY, PixelType.GAS
          ];
          const type = types[Math.floor((this.time * 10 + i) % types.length)];
          this.world.setPixelScreen(px, py, type);
        }
        
        lastDragX = x;
        lastDragY = y;
      }
    });
  }

  addBlock(block: Block): void {
    const visual = new BlockVisual(block, this.world, this.screenWidth, this.screenHeight);
    this.blocks.set(block.number, visual);
    this.world.addBlockEntity(visual);
    
    // Check if we need to remove old blocks (with melt effect)
    if (this.blocks.size > 50) {
      const oldest = Math.min(...this.blocks.keys());
      const oldVisual = this.blocks.get(oldest);
      if (oldVisual) {
        // Initiate melt-down effect instead of instant removal
        oldVisual.destroy();
      }
    }
    
    if (this.blockCountElement) {
      this.blockCountElement.textContent = this.blocks.size.toString();
    }
  }

  addTransaction(tx: Transaction): void {
    const visual = new TransactionVisual(tx, this.world, this.screenWidth, this.screenHeight);
    this.pendingTransactions.push(visual);
    this.world.addTransactionEntity(visual);
    // Note: tx-count is updated in main.ts based on block.transactions.length
  }

  start(): void {
    this.running = true;
    this.lastTime = performance.now();
    this.loop();
  }

  stop(): void {
    this.running = false;
    if (this.resizeTimeout) {
      clearTimeout(this.resizeTimeout);
      this.resizeTimeout = null;
    }
    this.world.destroy();
    this.infoPopup.destroy();
  }

  /**
   * Get the info popup instance.
   */
  getInfoPopup(): InfoPopup {
    return this.infoPopup;
  }

  /**
   * Set a callback for when a block is clicked.
   */
  setOnBlockClick(callback: (block: Block) => void): void {
    this.onBlockClick = callback;
  }

  /**
   * Set a callback for when the background is clicked (not on a block/transaction).
   */
  setOnBackgroundClick(callback: () => void): void {
    this.onBackgroundClick = callback;
  }

  /**
   * Get all active blocks (for external access).
   */
  getBlocks(): Map<number, BlockVisual> {
    return this.blocks;
  }

  /**
   * Clear all blocks and transactions (for chain switching).
   */
  clear(): void {
    this.blocks.clear();
    this.pendingTransactions = [];
    this.world.clear();
    if (this.blockCountElement) {
      this.blockCountElement.textContent = '0';
    }
  }

  private loop = (): void => {
    if (!this.running) return;

    const now = performance.now();
    const dt = (now - this.lastTime) / 1000;
    this.lastTime = now;
    this.time += dt;

    // Always update (physics, entity positions) even during resize
    this.update(dt);
    
    // Only render when not resizing to prevent artifacts
    if (!this.isResizing) {
      this.render();
    }

    requestAnimationFrame(this.loop);
  };

  private update(dt: number): void {
    this.world.update(dt);
    
    // Update all blocks and track destroyed ones
    const destroyedBlocks: number[] = [];
    for (const [number, block] of this.blocks) {
      block.update(dt);
      // Check if block is fully destroyed (melted)
      if (block.isDestroyed()) {
        destroyedBlocks.push(number);
      }
    }
    
    // Remove fully melted blocks
    for (const number of destroyedBlocks) {
      const visual = this.blocks.get(number);
      if (visual) {
        this.world.removeBlockEntity(visual);
      }
      this.blocks.delete(number);
    }
    
    if (destroyedBlocks.length > 0 && this.blockCountElement) {
      this.blockCountElement.textContent = this.blocks.size.toString();
    }
    for (const tx of this.pendingTransactions) {
      tx.update(dt);
    }
    
    // Remove completed transactions from both the array and the world
    const completedTxs = this.pendingTransactions.filter(tx => tx.isComplete());
    for (const tx of completedTxs) {
      this.world.removeTransactionEntity(tx);
    }
    this.pendingTransactions = this.pendingTransactions.filter(tx => !tx.isComplete());
    
    this.ambientParticleTimer += dt;
    if (this.ambientParticleTimer > 1.0) {
      this.ambientParticleTimer = 0;
      this.addAmbientParticles();
    }
  }

  private addAmbientParticles(): void {
    // Add ambient particles at edges
    for (let i = 0; i < 5; i++) {
      const edge = Math.floor(Math.random() * 4);
      let x, y;
      
      switch (edge) {
        case 0: x = Math.random() * this.screenWidth; y = 0; break;
        case 1: x = this.screenWidth; y = Math.random() * this.screenHeight; break;
        case 2: x = Math.random() * this.screenWidth; y = this.screenHeight; break;
        default: x = 0; y = Math.random() * this.screenHeight;
      }
      
      const types = [PixelType.DUST, PixelType.EMBER, PixelType.SPARK];
      const type = types[Math.floor(Math.random() * types.length)];
      this.world.setPixelScreen(x, y, type);
    }
  }

  private render(): void {
    // Skip rendering during resize to prevent artifacts
    if (this.isResizing) {
      return;
    }
    
    // Use stored dimensions instead of getBoundingClientRect() to avoid
    // stale values during resize that cause white pixels at old positions
    const width = this.screenWidth;
    const height = this.screenHeight;
    
    // Dark space background - fill entire canvas first to clear any traces
    this.ctx.fillStyle = '#0a0a12';
    this.ctx.fillRect(0, 0, width, height);
    
    // Then draw gradient on top
    const bgGradient = this.ctx.createRadialGradient(
      width / 2, height / 2, 0,
      width / 2, height / 2, Math.max(width, height)
    );
    bgGradient.addColorStop(0, '#0f0f18');
    bgGradient.addColorStop(0.5, '#0a0a12');
    bgGradient.addColorStop(1, '#050508');
    this.ctx.fillStyle = bgGradient;
    this.ctx.fillRect(0, 0, width, height);
    
    // Render pixel world (handles PIXEL_SIZE scaling)
    this.world.render(this.ctx, width, height);
    
    // Render entities with pixel-art style (quantized to PIXEL_SIZE)
    this.ctx.save();
    // Disable anti-aliasing for pixel art look
    this.ctx.imageSmoothingEnabled = false;
    
    for (const block of this.blocks.values()) {
      block.render(this.ctx);
    }
    
    for (const tx of this.pendingTransactions) {
      tx.render(this.ctx);
    }
    
    this.ctx.restore();
    
    // Mouse glow
    this.renderMouseGlow();
  }

  private renderMouseGlow(): void {
    const gradient = this.ctx.createRadialGradient(
      this.mouseX, this.mouseY, 0,
      this.mouseX, this.mouseY, 150
    );
    gradient.addColorStop(0, 'rgba(96, 165, 250, 0.1)');
    gradient.addColorStop(0.5, 'rgba(96, 165, 250, 0.03)');
    gradient.addColorStop(1, 'transparent');
    this.ctx.fillStyle = gradient;
    // Use stored dimensions instead of canvas.width (which is DPR-scaled)
    this.ctx.fillRect(0, 0, this.screenWidth, this.screenHeight);
  }
}