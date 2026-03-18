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
  // Tab visibility handling
  private isVisible: boolean = true;
  private visibilityChangeHandler: (() => void) | null = null;
  // Laser mode state
  private laserMode: boolean = false;
  private laserBeam: { startX: number; startY: number; endX: number; endY: number; progress: number; active: boolean } | null = null;
  private onLaserFire: (() => void) | null = null;
  
  // Scoring system for laser mode
  private laserScore: number = 0;
  private scoreElement: HTMLElement | null = null;
  
  // Score values for different entity types
  private static readonly SCORE_BLOCK = 5;
  private static readonly SCORE_TRANSACTION = 10;
  private static readonly SCORE_TOKEN = 20;
  private static readonly SCORE_INFERENCE = 50;
  private static readonly SCORE_CONTRACT = 100;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Could not get 2D context');
    this.ctx = ctx;
    // Will be properly sized in setupCanvas()
    this.world = new PixelWorld(800, 600);
    this.blockCountElement = document.getElementById('block-count');
    this.txCountElement = document.getElementById('tx-count');
    this.scoreElement = document.getElementById('laser-score');
    
    this.setupCanvas();
    this.infoPopup = new InfoPopup();
    this.setupEventListeners();
    this.setupVisibilityHandler();
    this.setupContextLossHandler();
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
      
      // Get dimensions from the container for accurate sizing
      const container = this.canvas.parentElement;
      const rect = container ? container.getBoundingClientRect() : this.canvas.getBoundingClientRect();
      
      // Ensure we have valid dimensions - use window size as fallback
      let width = Math.max(100, rect.width);
      let height = Math.max(100, rect.height);
      
      // Fallback to window dimensions if container rect is too small
      if (width < 100 || height < 100) {
        width = Math.max(100, window.innerWidth);
        height = Math.max(100, window.innerHeight - 60); // Account for header
      }
      
      // Store actual screen dimensions
      this.screenWidth = width;
      this.screenHeight = height;
      
      // Set canvas buffer size (this CLEARS the canvas)
      this.canvas.width = width * dpr;
      this.canvas.height = height * dpr;
      
      // Reset transform and scale for CSS pixels
      this.ctx.setTransform(1, 0, 0, 1, 0, 0);
      this.ctx.scale(dpr, dpr);
      
      // Fill with background immediately after buffer resize
      this.ctx.fillStyle = '#0a0a12';
      this.ctx.fillRect(0, 0, width, height);
      
      // Update world with actual screen dimensions
      this.world.resize(width, height);
      
      // Update existing entities with new dimensions
      this.updateEntityDimensions();
      
      // Debounce the resize end
      this.resizeTimeout = setTimeout(() => {
        this.isResizing = false;
        console.log(`Canvas resized: ${width}x${height} (DPR: ${dpr})`);
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

  /**
   * Set up visibility change handler to prevent black screen on tab switch.
   * When a tab is backgrounded, requestAnimationFrame stops running and the
   * canvas may be cleared by the browser. This handler forces a re-render
   * when the tab becomes visible again.
   */
  private setupVisibilityHandler(): void {
    this.visibilityChangeHandler = () => {
      const wasHidden = !this.isVisible;
      this.isVisible = document.visibilityState === 'visible';
      
      if (this.isVisible && wasHidden) {
        // Tab just became visible again - force immediate re-render
        // to clear any black screen
        console.log('[Engine] Tab visible again, forcing re-render');
        // Reset timing to avoid large delta time jump
        this.lastTime = performance.now();
        // Notify the world about visibility change (for worker)
        this.world.handleVisibilityChange(true);
        // Force an immediate render
        this.render();
      } else if (!this.isVisible && wasHidden) {
        // Tab is now hidden - notify the world
        console.log('[Engine] Tab hidden, pausing updates');
        this.world.handleVisibilityChange(false);
      }
    };
    
    document.addEventListener('visibilitychange', this.visibilityChangeHandler);
  }

  /**
   * Set up canvas context loss handler to prevent black screen.
   * When a tab is backgrounded for extended periods, browsers may reclaim
   * GPU resources, causing the canvas context to be lost. This handler
   * attempts to recover by forcing a full re-render.
   */
  private setupContextLossHandler(): void {
    // Note: Canvas 2D contexts don't have webglcontextlost events,
    // but we can handle visibility-related issues and resize events
    // that may cause similar problems.
    
    // Handle window focus - sometimes canvas needs a repaint after alt-tab
    window.addEventListener('focus', () => {
      if (this.isVisible && this.initialized) {
        // Force a repaint on focus
        this.forceRender();
      }
    });
    
    // Handle pageshow event - triggered when page is restored from bfcache
    window.addEventListener('pageshow', (event) => {
      if (event.persisted) {
        console.log('[Engine] Page restored from bfcache, forcing re-render');
        this.forceRender();
      }
    });
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

      // Laser mode - fire laser and destroy target
      if (this.laserMode) {
        this.fireLaser(x, y);
        return; // Don't show info popup or create regular explosion
      }

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

  // Maximum number of blocks allowed on screen
  private static readonly MAX_BLOCKS = 80;

  addBlock(block: Block): void {
    const visual = new BlockVisual(block, this.world, this.screenWidth, this.screenHeight);
    this.blocks.set(block.number, visual);
    this.world.addBlockEntity(visual);
    
    // Check if we need to remove old blocks (with melt effect)
    // Remove enough blocks to get back under the limit
    while (this.blocks.size > Engine.MAX_BLOCKS) {
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
    // Clean up visibility handler
    if (this.visibilityChangeHandler) {
      document.removeEventListener('visibilitychange', this.visibilityChangeHandler);
      this.visibilityChangeHandler = null;
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

  /**
   * Force an immediate re-render of the canvas.
   * Useful for recovering from visibility changes or other
   * scenarios where the canvas may have been cleared.
   */
  forceRender(): void {
    if (this.screenWidth > 0 && this.screenHeight > 0) {
      this.render();
    }
  }

  /**
   * Set laser mode on/off.
   */
  setLaserMode(enabled: boolean): void {
    this.laserMode = enabled;
    // Reset score when entering laser mode
    if (enabled) {
      this.laserScore = 0;
      this.updateScoreDisplay();
    }
  }

  /**
   * Get current laser mode state.
   */
  isLaserMode(): boolean {
    return this.laserMode;
  }
  
  /**
   * Get current laser score.
   */
  getLaserScore(): number {
    return this.laserScore;
  }
  
  /**
   * Add points to the laser score and update display.
   */
  private addScore(points: number): void {
    this.laserScore += points;
    this.updateScoreDisplay();
  }
  
  /**
   * Update the score display element.
   */
  private updateScoreDisplay(): void {
    if (this.scoreElement) {
      this.scoreElement.textContent = this.laserScore.toLocaleString();
    }
  }

  /**
   * Set a callback for when the laser is fired.
   */
  setOnLaserFire(callback: () => void): void {
    this.onLaserFire = callback;
  }

  /**
   * Create a reduced explosion effect for laser mode.
   * Less intense than the fireworkpalm to allow visibility of targets.
   */
  private createReducedExplosion(x: number, y: number): void {
    // Fewer branches and particles for better visibility
    const branchCount = 4 + Math.floor(Math.random() * 2);
    
    for (let branch = 0; branch < branchCount; branch++) {
      const angle = (branch / branchCount) * Math.PI * 2 + Math.random() * 0.15;
      
      // Shorter trunks for reduced effect
      const trunkLength = 15 + Math.random() * 10;
      for (let i = 0; i < trunkLength; i++) {
        const dist = i * 1.2;
        const px = x + Math.cos(angle) * dist;
        const py = y + Math.sin(angle) * dist;
        
        const rand = Math.random();
        let type: PixelType;
        if (rand < 0.5) type = PixelType.SPARK;
        else if (rand < 0.8) type = PixelType.PLASMA;
        else type = PixelType.ENERGY;
        
        this.world.setPixelScreen(px, py, type);
      }
      
      // Fewer sparks shooting out
      for (let i = 0; i < 2; i++) {
        const sparkAngle = angle + (Math.random() - 0.5) * 0.3;
        const sparkDist = trunkLength * 1.2 + Math.random() * 10;
        const sx = x + Math.cos(sparkAngle) * sparkDist;
        const sy = y + Math.sin(sparkAngle) * sparkDist;
        this.world.setPixelScreen(sx, sy, PixelType.SPARK);
      }
    }
    
    // Smaller central flash
    for (let i = 0; i < 8; i++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = Math.random() * 10;
      const px = x + Math.cos(angle) * dist;
      const py = y + Math.sin(angle) * dist;
      this.world.setPixelScreen(px, py, PixelType.ENERGY);
    }
    
    // Smaller ground effect
    this.world.createExplosion(x, y, 30, 1.5);
  }

  /**
   * Create a firework palm explosion effect.
   * This creates a burst pattern similar to a firework palm tree shape.
   */
  private createFireworkPalmExplosion(x: number, y: number): void {
    // Create multiple branches radiating outward like a palm tree
    const branchCount = 8 + Math.floor(Math.random() * 4);
    
    for (let branch = 0; branch < branchCount; branch++) {
      const angle = (branch / branchCount) * Math.PI * 2 + Math.random() * 0.2;
      
      // Main trunk of each branch
      const trunkLength = 30 + Math.random() * 20;
      for (let i = 0; i < trunkLength; i++) {
        const dist = i * 1.5;
        const px = x + Math.cos(angle) * dist;
        const py = y + Math.sin(angle) * dist;
        
        // Fire colors along the trunk
        const rand = Math.random();
        let type: PixelType;
        if (rand < 0.3) type = PixelType.FIRE;
        else if (rand < 0.6) type = PixelType.SPARK;
        else if (rand < 0.8) type = PixelType.PLASMA;
        else type = PixelType.EXPLOSION;
        
        this.world.setPixelScreen(px, py, type);
      }
      
      // Palm fronds at the end - spreading outward
      const frondCount = 3 + Math.floor(Math.random() * 3);
      for (let f = 0; f < frondCount; f++) {
        const frondAngle = angle + (f - frondCount / 2) * 0.3;
        const frondLength = 15 + Math.random() * 15;
        const startX = x + Math.cos(angle) * trunkLength * 1.2;
        const startY = y + Math.sin(angle) * trunkLength * 1.2;
        
        for (let i = 0; i < frondLength; i++) {
          const px = startX + Math.cos(frondAngle) * i * 1.2;
          const py = startY + Math.sin(frondAngle) * i * 1.2;
          
          // Brighter colors at the fronds
          const rand = Math.random();
          let type: PixelType;
          if (rand < 0.4) type = PixelType.SPARK;
          else if (rand < 0.7) type = PixelType.PLASMA;
          else if (rand < 0.9) type = PixelType.ENERGY;
          else type = PixelType.LIGHTNING;
          
          this.world.setPixelScreen(px, py, type);
        }
      }
      
      // Extra sparks shooting out
      for (let i = 0; i < 5; i++) {
        const sparkAngle = angle + (Math.random() - 0.5) * 0.5;
        const sparkDist = trunkLength * 1.5 + Math.random() * 20;
        const sx = x + Math.cos(sparkAngle) * sparkDist;
        const sy = y + Math.sin(sparkAngle) * sparkDist;
        this.world.setPixelScreen(sx, sy, PixelType.SPARK);
      }
    }
    
    // Central bright flash
    for (let i = 0; i < 20; i++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = Math.random() * 20;
      const px = x + Math.cos(angle) * dist;
      const py = y + Math.sin(angle) * dist;
      this.world.setPixelScreen(px, py, PixelType.LIGHTNING);
    }
    
    // Ground effect - create explosion physics
    this.world.createExplosion(x, y, 60, 2);
  }

  /**
   * Fire a laser beam and destroy the target.
   */
  private fireLaser(targetX: number, targetY: number): void {
    // Notify callback for sound effect
    if (this.onLaserFire) {
      this.onLaserFire();
    }
    
    // Determine best edge to shoot from (pick closest edge)
    const edges = [
      { x: 0, y: targetY }, // left edge
      { x: this.screenWidth, y: targetY }, // right edge
      { x: targetX, y: 0 }, // top edge
      { x: targetX, y: this.screenHeight }, // bottom edge
    ];
    
    // Pick the closest edge
    let startX = edges[0].x;
    let startY = edges[0].y;
    let minDist = Infinity;
    
    for (const edge of edges) {
      const dist = Math.sqrt((edge.x - targetX) ** 2 + (edge.y - targetY) ** 2);
      if (dist < minDist) {
        minDist = dist;
        startX = edge.x;
        startY = edge.y;
      }
    }
    
    // Initialize laser beam animation
    this.laserBeam = {
      startX,
      startY,
      endX: targetX,
      endY: targetY,
      progress: 0,
      active: true
    };
    
    // Create particles along the beam path
    const beamLength = Math.sqrt((targetX - startX) ** 2 + (targetY - startY) ** 2);
    const steps = Math.floor(beamLength / 4);
    
    for (let i = 0; i < steps; i++) {
      const t = i / steps;
      const px = startX + (targetX - startX) * t;
      const py = startY + (targetY - startY) * t;
      
      // Add laser particles with some randomness
      if (Math.random() < 0.7) {
        const offsetX = (Math.random() - 0.5) * 8;
        const offsetY = (Math.random() - 0.5) * 8;
        this.world.setPixelScreen(px + offsetX, py + offsetY, PixelType.PLASMA);
      }
    }
    
    // Check for hits on blocks and transactions
    let hitSomething = false;
    
    for (const block of this.blocks.values()) {
      if (block.containsPoint(targetX, targetY)) {
        block.destroy();
        // Score for hitting a block
        this.addScore(Engine.SCORE_BLOCK);
        hitSomething = true;
        // Create reduced explosion at block position
        const pos = block.getPosition();
        this.createReducedExplosion(pos.x, pos.y);
        break;
      }
    }
    
    // Check for hits on transactions
    for (const tx of this.pendingTransactions) {
      const pos = tx.getPosition();
      const dx = targetX - pos.x;
      const dy = targetY - pos.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      if (distance <= 20) {
        const txData = tx.getTransaction();
        tx.destroy();
        hitSomething = true;
        
        // Score based on transaction type
        switch (txData.type) {
          case 'inference':
            this.addScore(Engine.SCORE_INFERENCE);
            break;
          case 'contract':
            this.addScore(Engine.SCORE_CONTRACT);
            break;
          case 'token':
            this.addScore(Engine.SCORE_TOKEN);
            break;
          default:
            this.addScore(Engine.SCORE_TRANSACTION);
        }
        
        this.createReducedExplosion(pos.x, pos.y);
        break;
      }
    }
    
    // If no hit, still create small explosion at click point
    if (this.laserMode && !hitSomething) {
      this.createReducedExplosion(targetX, targetY);
    }
  }

  private loop = (): void => {
    if (!this.running) return;

    const now = performance.now();
    let dt = (now - this.lastTime) / 1000;
    this.lastTime = now;

    // Clamp delta time to prevent physics explosions after tab switches
    // Maximum 100ms (10 FPS equivalent) to prevent instability
    dt = Math.min(dt, 0.1);

    // Skip updates and rendering when tab is hidden
    // This prevents physics issues from large time deltas
    // and saves CPU/GPU resources
    if (!this.isVisible) {
      requestAnimationFrame(this.loop);
      return;
    }

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
    
    // Update laser beam animation
    if (this.laserBeam && this.laserBeam.active) {
      this.laserBeam.progress += dt * 5; // Fast animation
      if (this.laserBeam.progress >= 1) {
        this.laserBeam.active = false;
        this.laserBeam = null;
      }
    }
    
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
    
    // Ensure we have valid dimensions before rendering
    if (this.screenWidth <= 0 || this.screenHeight <= 0) {
      console.warn('[Engine] Invalid screen dimensions, skipping render');
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
    
    // Render laser beam if active
    this.renderLaserBeam();
  }

  private renderLaserBeam(): void {
    if (!this.laserBeam || !this.laserBeam.active) return;
    
    const { startX, startY, endX, endY, progress } = this.laserBeam;
    
    // Calculate current beam end position (animated)
    const currentEndX = startX + (endX - startX) * Math.min(1, progress * 2);
    const currentEndY = startY + (endY - startY) * Math.min(1, progress * 2);
    
    // Draw multiple layers for glow effect (GREEN LASER)
    // Outer glow
    this.ctx.strokeStyle = 'rgba(50, 255, 100, 0.3)';
    this.ctx.lineWidth = 12;
    this.ctx.lineCap = 'round';
    this.ctx.beginPath();
    this.ctx.moveTo(startX, startY);
    this.ctx.lineTo(currentEndX, currentEndY);
    this.ctx.stroke();
    
    // Middle glow
    this.ctx.strokeStyle = 'rgba(100, 255, 150, 0.5)';
    this.ctx.lineWidth = 6;
    this.ctx.beginPath();
    this.ctx.moveTo(startX, startY);
    this.ctx.lineTo(currentEndX, currentEndY);
    this.ctx.stroke();
    
    // Inner core
    this.ctx.strokeStyle = 'rgba(200, 255, 220, 0.9)';
    this.ctx.lineWidth = 3;
    this.ctx.beginPath();
    this.ctx.moveTo(startX, startY);
    this.ctx.lineTo(currentEndX, currentEndY);
    this.ctx.stroke();
    
    // Impact flash at target (green)
    if (progress > 0.5) {
      const flashProgress = (progress - 0.5) * 2;
      const flashRadius = 30 + flashProgress * 50;
      const flashAlpha = 1 - flashProgress;
      
      const flash = this.ctx.createRadialGradient(endX, endY, 0, endX, endY, flashRadius);
      flash.addColorStop(0, `rgba(200, 255, 200, ${flashAlpha})`);
      flash.addColorStop(0.3, `rgba(100, 255, 100, ${flashAlpha * 0.7})`);
      flash.addColorStop(1, 'rgba(50, 255, 50, 0)');
      
      this.ctx.fillStyle = flash;
      this.ctx.beginPath();
      this.ctx.arc(endX, endY, flashRadius, 0, Math.PI * 2);
      this.ctx.fill();
    }
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