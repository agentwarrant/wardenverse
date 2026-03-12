/**
 * Pixel World - Contains the pixel physics simulation
 * Noita-inspired visual effects with glow and particles
 * Uses PIXEL_SIZE multiplier for performance (4x4 screen pixels per game pixel)
 */

import { PixelType, PIXEL_PROPERTIES } from './PixelTypes';
import { PIXEL_SIZE, AMBIENT_PARTICLE_DENSITY } from './Config';

export class PixelWorld {
  private screenWidth: number;
  private screenHeight: number;
  private width: number; // Physics grid width (screenWidth / PIXEL_SIZE)
  private height: number; // Physics grid height (screenHeight / PIXEL_SIZE)
  private pixels: Uint8Array;
  private blockEntities: any[] = [];
  private transactionEntities: any[] = [];
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private glowCanvas: HTMLCanvasElement;
  private glowCtx: CanvasRenderingContext2D;
  private imageData: ImageData;
  private worker: Worker | null = null;
  private pendingPixels: Array<{ x: number; y: number; pixelType: PixelType }> = [];
  private pendingExplosions: Array<{ x: number; y: number; radius: number; intensity: number }> = [];
  private workerReady: boolean = false;
  private frameCount: number = 0;
  private lastFpsUpdate: number = 0;
  private fps: number = 0;
  private time: number = 0;

  constructor(screenWidth: number, screenHeight: number) {
    // Use minimum size to ensure grid is valid even with small inputs
    this.screenWidth = Math.max(100, Math.floor(screenWidth));
    this.screenHeight = Math.max(100, Math.floor(screenHeight));
    // Physics grid is smaller by PIXEL_SIZE factor
    this.width = Math.max(25, Math.floor(this.screenWidth / PIXEL_SIZE));
    this.height = Math.max(25, Math.floor(this.screenHeight / PIXEL_SIZE));
    this.pixels = new Uint8Array(this.width * this.height);
    
    // Create offscreen canvas at physics grid resolution
    this.canvas = document.createElement('canvas');
    this.canvas.width = this.width;
    this.canvas.height = this.height;
    const ctx = this.canvas.getContext('2d');
    if (!ctx) throw new Error('Could not get 2D context');
    this.ctx = ctx;
    this.imageData = this.ctx.createImageData(this.width, this.height);
    
    // Glow canvas (also at physics resolution)
    this.glowCanvas = document.createElement('canvas');
    this.glowCanvas.width = this.width;
    this.glowCanvas.height = this.height;
    const glowCtx = this.glowCanvas.getContext('2d');
    if (!glowCtx) throw new Error('Could not get glow 2D context');
    this.glowCtx = glowCtx;
    
    this.initializeWorker();
    this.initialize();
    
    // Log dimensions for debugging
    console.log(`PixelWorld initialized: screen=${this.screenWidth}x${this.screenHeight}, grid=${this.width}x${this.height}, pixelSize=${PIXEL_SIZE}`);
  }

  private initializeWorker(): void {
    try {
      this.worker = new Worker(
        new URL('./PhysicsWorker.ts', import.meta.url),
        { type: 'module' }
      );
      
      this.worker.onmessage = (e) => {
        const msg = e.data;
        switch (msg.type) {
          case 'ready':
            this.workerReady = true;
            for (const p of this.pendingPixels) {
              this.worker?.postMessage({ type: 'setPixel', x: p.x, y: p.y, pixelType: p.pixelType });
            }
            this.pendingPixels = [];
            for (const exp of this.pendingExplosions) {
              this.worker?.postMessage({ type: 'explosion', ...exp });
            }
            this.pendingExplosions = [];
            break;
          case 'pixels':
            this.pixels = msg.data;
            break;
          case 'error':
            console.error('Physics worker error:', msg.message);
            break;
        }
      };
      
      this.worker.postMessage({ type: 'init', width: this.width, height: this.height });
    } catch (error) {
      console.warn('WebWorker not available, falling back to main thread:', error);
      this.worker = null;
      this.workerReady = true;
    }
  }

  private initialize(): void {
    this.pixels.fill(PixelType.EMPTY);
    this.addAmbientParticles();
  }

  private addAmbientParticles(): void {
    // Scale particle count by physics grid size
    const particleCount = Math.floor(this.width * this.height * AMBIENT_PARTICLE_DENSITY);
    for (let i = 0; i < particleCount; i++) {
      const x = Math.floor(Math.random() * this.width);
      const y = Math.floor(Math.random() * this.height);
      const type = Math.random() > 0.85 ? PixelType.STAR : Math.random() > 0.7 ? PixelType.DUST : PixelType.EMBER;
      this.setPixel(x, y, type);
    }
  }

  resize(screenWidth: number, screenHeight: number): void {
    this.screenWidth = Math.max(100, Math.floor(screenWidth));
    this.screenHeight = Math.max(100, Math.floor(screenHeight));
    this.width = Math.max(25, Math.floor(this.screenWidth / PIXEL_SIZE));
    this.height = Math.max(25, Math.floor(this.screenHeight / PIXEL_SIZE));
    
    // Replace pixels array with new size
    this.pixels = new Uint8Array(this.width * this.height);
    
    // Resize canvases
    this.canvas.width = this.width;
    this.canvas.height = this.height;
    this.imageData = this.ctx.createImageData(this.width, this.height);
    this.glowCanvas.width = this.width;
    this.glowCanvas.height = this.height;
    
    // Resize worker
    if (this.worker && this.workerReady) {
      this.worker.postMessage({ type: 'resize', width: this.width, height: this.height });
    }
    
    // Re-initialize particles for the new size
    this.initialize();
    
    console.log(`PixelWorld resized: screen=${this.screenWidth}x${this.screenHeight}, grid=${this.width}x${this.height}`);
  }

  addBlockEntity(entity: any): void {
    this.blockEntities.push(entity);
  }

  removeBlockEntity(entity: any): void {
    const idx = this.blockEntities.indexOf(entity);
    if (idx > -1) this.blockEntities.splice(idx, 1);
  }

  addTransactionEntity(entity: any): void {
    this.transactionEntities.push(entity);
  }

  // Convert screen coordinates to physics grid coordinates
  screenToGrid(screenX: number, screenY: number): { x: number; y: number } {
    return {
      x: Math.floor(screenX / PIXEL_SIZE),
      y: Math.floor(screenY / PIXEL_SIZE)
    };
  }

  // Convert physics grid coordinates to screen coordinates
  gridToScreen(gridX: number, gridY: number): { x: number; y: number } {
    return {
      x: gridX * PIXEL_SIZE,
      y: gridY * PIXEL_SIZE
    };
  }

  createExplosion(screenX: number, screenY: number, radius: number = 20, intensity: number = 1): void {
    // Convert to grid coordinates and scale radius
    const grid = this.screenToGrid(screenX, screenY);
    const gridRadius = Math.floor(radius / PIXEL_SIZE);
    
    if (this.worker && this.workerReady) {
      this.worker.postMessage({ 
        type: 'explosion', 
        x: grid.x, 
        y: grid.y, 
        radius: gridRadius, 
        intensity 
      });
    } else {
      this.pendingExplosions.push({ x: grid.x, y: grid.y, radius: gridRadius, intensity });
    }
  }

  update(dt: number): void {
    this.time += dt;
    
    // Update FPS counter
    this.frameCount++;
    const now = performance.now();
    if (now - this.lastFpsUpdate >= 1000) {
      this.fps = this.frameCount;
      this.frameCount = 0;
      this.lastFpsUpdate = now;
    }
    
    // Use worker for physics if available
    if (this.worker && this.workerReady) {
      this.worker.postMessage({ type: 'update', dt });
    }
    
    // Update entities
    for (const entity of this.blockEntities) {
      entity.update(dt);
    }
    for (const entity of this.transactionEntities) {
      entity.update(dt);
    }
  }

  private updatePhysicsMainThread(dt: number): void {
    // Simplified main thread physics fallback
    const gravity = 50 * dt;
    
    for (let y = this.height - 2; y >= 0; y--) {
      for (let x = 0; x < this.width; x++) {
        const idx = y * this.width + x;
        const pixelType = this.pixels[idx];
        
        if (pixelType === PixelType.EMPTY) continue;
        
        const props = PIXEL_PROPERTIES[pixelType as PixelType];
        if (!props) continue;
        
        if (props.gravity > 0) {
          const belowIdx = (y + 1) * this.width + x;
          if (y < this.height - 1 && this.canMove(pixelType, belowIdx)) {
            this.swapPixels(idx, belowIdx);
          }
        }
      }
    }
  }

  private canMove(fromType: PixelType, toIdx: number): boolean {
    if (toIdx < 0 || toIdx >= this.pixels.length) return false;
    const toType = this.pixels[toIdx];
    return toType === PixelType.EMPTY || toType === PixelType.DUST;
  }

  private swapPixels(idx1: number, idx2: number): void {
    const temp = this.pixels[idx1];
    this.pixels[idx1] = this.pixels[idx2];
    this.pixels[idx2] = temp;
  }

  setPixel(gridX: number, gridY: number, type: PixelType): void {
    if (gridX < 0 || gridX >= this.width || gridY < 0 || gridY >= this.height) return;
    const idx = Math.floor(gridY) * this.width + Math.floor(gridX);
    this.pixels[idx] = type;
    
    if (this.worker && this.workerReady) {
      this.worker.postMessage({ type: 'setPixel', x: Math.floor(gridX), y: Math.floor(gridY), pixelType: type });
    } else {
      this.pendingPixels.push({ x: Math.floor(gridX), y: Math.floor(gridY), pixelType: type });
    }
  }

  // Set pixel using screen coordinates (convenience method)
  setPixelScreen(screenX: number, screenY: number, type: PixelType): void {
    const grid = this.screenToGrid(screenX, screenY);
    this.setPixel(grid.x, grid.y, type);
  }

  getPixel(gridX: number, gridY: number): PixelType {
    if (gridX < 0 || gridX >= this.width || gridY < 0 || gridY >= this.height) return PixelType.EMPTY;
    const idx = Math.floor(gridY) * this.width + Math.floor(gridX);
    return this.pixels[idx];
  }

  getFps(): number {
    return this.fps;
  }

  getResolution(): { width: number; height: number } {
    return { width: this.width, height: this.height };
  }

  getScreenResolution(): { width: number; height: number } {
    return { width: this.screenWidth, height: this.screenHeight };
  }

  render(ctx: CanvasRenderingContext2D, screenWidth?: number, screenHeight?: number): void {
    const data = this.imageData.data;
    const flickerTime = this.time * 10;
    
    // Clear to dark background
    for (let i = 0; i < data.length; i += 4) {
      data[i] = 10;
      data[i + 1] = 10;
      data[i + 2] = 15;
      data[i + 3] = 255;
    }
    
    // Clear glow canvas
    this.glowCtx.clearRect(0, 0, this.width, this.height);
    
    // Update image data from pixels with enhanced glow
    for (let i = 0; i < this.pixels.length; i++) {
      const pixelType = this.pixels[i];
      const props = PIXEL_PROPERTIES[pixelType as PixelType];
      
      if (!props) continue;
      
      const offset = i * 4;
      let r = props.color[0];
      let g = props.color[1];
      let b = props.color[2];
      let a = props.color[3];
      
      // Apply flicker effect
      if (props.flickerRate > 0) {
        const flicker = 0.7 + 0.3 * Math.sin(flickerTime + i * 0.1);
        const variance = props.flickerRate * (1 - flicker);
        r = Math.min(255, Math.floor(r * (1 - variance) + r * variance * Math.random()));
        g = Math.min(255, Math.floor(g * (1 - variance) + g * variance * Math.random()));
        b = Math.min(255, Math.floor(b * (1 - variance) + b * variance * Math.random()));
      }
      
      // Enhance glow for emissive particles
      if (props.glow && props.glowIntensity > 0) {
        const glowBoost = props.glowIntensity * 0.5;
        r = Math.min(255, Math.floor(r + 255 * glowBoost));
        g = Math.min(255, Math.floor(g + 255 * glowBoost));
        b = Math.min(255, Math.floor(b + 255 * glowBoost));
        
        // Draw glow on glow canvas
        const x = i % this.width;
        const y = Math.floor(i / this.width);
        const glowRadius = Math.floor(1 + props.glowIntensity * 2);
        const gradient = this.glowCtx.createRadialGradient(x, y, 0, x, y, glowRadius);
        gradient.addColorStop(0, `rgba(${props.color[0]}, ${props.color[1]}, ${props.color[2]}, ${0.6 * props.glowIntensity})`);
        gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
        this.glowCtx.fillStyle = gradient;
        this.glowCtx.fillRect(x - glowRadius, y - glowRadius, glowRadius * 2, glowRadius * 2);
      }
      
      data[offset] = r;
      data[offset + 1] = g;
      data[offset + 2] = b;
      data[offset + 3] = a;
    }
    
    this.ctx.putImageData(this.imageData, 0, 0);
    
    // Composite glow layer
    this.ctx.globalCompositeOperation = 'lighter';
    this.ctx.drawImage(this.glowCanvas, 0, 0);
    this.ctx.globalCompositeOperation = 'source-over';
    
    // Scale up to screen size using nearest-neighbor for pixel art look
    // Use passed dimensions to avoid stale getBoundingClientRect() values during resize
    const targetWidth = screenWidth ?? this.screenWidth;
    const targetHeight = screenHeight ?? this.screenHeight;
    ctx.imageSmoothingEnabled = false; // Crisp pixel scaling
    ctx.drawImage(this.canvas, 0, 0, targetWidth, targetHeight);
  }

  destroy(): void {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
  }

  /**
   * Clear all pixels and entities (for chain switching).
   */
  clear(): void {
    // Reset all pixels to empty
    this.pixels.fill(PixelType.EMPTY);
    
    // Clear block and transaction entities
    this.blockEntities = [];
    this.transactionEntities = [];
  }
}