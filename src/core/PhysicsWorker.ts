/**
 * WebWorker for physics simulation
 * Runs the pixel physics simulation off the main thread
 */

import { PixelType, PIXEL_PROPERTIES } from './PixelTypes';

// Worker message types
type InitMessage = { type: 'init'; width: number; height: number };
type UpdateMessage = { type: 'update'; dt: number };
type SetPixelMessage = { type: 'setPixel'; x: number; y: number; pixelType: PixelType };
type ResizeMessage = { type: 'resize'; width: number; height: number };

type WorkerMessage = InitMessage | UpdateMessage | SetPixelMessage | ResizeMessage;

type WorkerResponse =
  | { type: 'ready' }
  | { type: 'pixels'; data: Uint8Array }
  | { type: 'error'; message: string };

// Shared state
let width = 0;
let height = 0;
let pixels: Uint8Array;
let pixelData: Float32Array; // velocity, temperature, lifetime, etc.

function initialize(w: number, h: number): void {
  width = Math.floor(w);
  height = Math.floor(h);
  pixels = new Uint8Array(width * height);
  pixelData = new Float32Array(width * height * 4);
  
  // Initialize with empty space
  pixels.fill(PixelType.EMPTY);
  
  // Add ambient stars
  for (let i = 0; i <200; i++) {
    const x = Math.floor(Math.random() * width);
    const y = Math.floor(Math.random() * height);
    const idx = y * width + x;
    pixels[idx] = Math.random() > 0.7 ? PixelType.STAR : PixelType.DUST;
  }
}

function updatePhysics(dt: number): void {
  // Process from bottom to top for falling
  for (let y = height - 2; y >= 0; y--) {
    const randomStart = Math.random() > 0.5 ? 0 : 1;
    const startX = randomStart === 0 ? 0 : width - 1;
    const endX = randomStart === 0 ? width : -1;
    const step = randomStart === 0 ? 1 : -1;
    
    for (let x = startX; x !== endX; x += step) {
      const idx = y * width + x;
      const pixelType = pixels[idx];
      
      if (pixelType === PixelType.EMPTY) continue;
      
      const props = PIXEL_PROPERTIES[pixelType as PixelType];
      if (!props) continue;
      
      // Apply gravity
      if (props.gravity > 0) {
        const belowIdx = (y + 1) * width + x;
        
        if (y < height - 1 && canMove(pixelType, idx, belowIdx)) {
          swapPixels(idx, belowIdx);
        } else if (y < height - 1) {
          const dir = Math.random() > 0.5 ? 1 : -1;
          const diagIdx = (y + 1) * width + (x + dir);
          if (x + dir >= 0 && x + dir < width && canMove(pixelType, idx, diagIdx)) {
            swapPixels(idx, diagIdx);
          }
        }
      }
      
      // Rising particles (fire, gas)
      if (props.gravity < 0) {
        const aboveIdx = (y - 1) * width + x;
        if (y > 0 && canMove(pixelType, idx, aboveIdx)) {
          swapPixels(idx, aboveIdx);
        } else if (y > 0) {
          const dir = Math.random() > 0.5 ? 1 : -1;
          const diagIdx = (y - 1) * width + (x + dir);
          if (x + dir >= 0 && x + dir < width && canMove(pixelType, idx, diagIdx)) {
            swapPixels(idx, diagIdx);
          }
        }
      }
      
      // Spread (liquids, gases)
      if (props.spread > 0 && Math.random() < props.spread * 0.3) {
        const dir = Math.random() > 0.5 ? 1 : -1;
        const sideIdx = y * width + (x + dir);
        if (x + dir >= 0 && x + dir < width && pixels[sideIdx] === PixelType.EMPTY) {
          swapPixels(idx, sideIdx);
        }
      }
      
      // Lifetime decay
      if (props.lifetime > 0) {
        const dataIdx = idx * 4;
        pixelData[dataIdx + 3] += dt * 1000; // Track elapsed time
        if (pixelData[dataIdx + 3] >= props.lifetime) {
          pixels[idx] = PixelType.EMPTY;
        }
      }
      
      // Interactions
      if (props.interactions && Object.keys(props.interactions).length > 0) {
        // Check neighbors for interactions
        const neighbors = [
          y > 0 ? (y - 1) * width + x : -1,
          y < height - 1 ? (y + 1) * width + x : -1,
          x > 0 ? y * width + (x - 1) : -1,
          x < width - 1 ? y * width + (x + 1) : -1,
        ];
        
        for (const nIdx of neighbors) {
          if (nIdx < 0) continue;
          const nType = pixels[nIdx] as PixelType;
          const result = props.interactions[nType];
          if (result !== undefined) {
            pixels[nIdx] = result;
          }
        }
      }
    }
  }
}

function canMove(fromType: PixelType, fromIdx: number, toIdx: number): boolean {
  if (toIdx < 0 || toIdx >= pixels.length) return false;
  const toType = pixels[toIdx];
  return toType === PixelType.EMPTY || toType === PixelType.DUST;
}

function swapPixels(idx1: number, idx2: number): void {
  const temp = pixels[idx1];
  pixels[idx1] = pixels[idx2];
  pixels[idx2] = temp;
  
  // Also swap pixel data
  for (let i = 0; i < 4; i++) {
    const tempData = pixelData[idx1 * 4 + i];
    pixelData[idx1 * 4 + i] = pixelData[idx2 * 4 + i];
    pixelData[idx2 * 4 + i] = tempData;
  }
}

function setPixel(x: number, y: number, newType: PixelType): void {
  if (x < 0 || x >= width || y < 0 || y >= height) return;
  const idx = Math.floor(y) * width + Math.floor(x);
  pixels[idx] = newType;
  // Reset lifetime counter
  pixelData[idx * 4 + 3] = 0;
}

function resize(w: number, h: number): void {
  const oldPixels = pixels;
  const oldWidth = width;
  const oldHeight = height;
  
  width = Math.floor(w);
  height = Math.floor(h);
  pixels = new Uint8Array(width * height);
  pixelData = new Float32Array(width * height * 4);
  pixels.fill(PixelType.EMPTY);
  
  // Copy old pixels
  const copyWidth = Math.min(oldWidth, width);
  const copyHeight = Math.min(oldHeight, height);
  for (let y = 0; y < copyHeight; y++) {
    for (let x = 0; x < copyWidth; x++) {
      const oldIdx = y * oldWidth + x;
      const newIdx = y * width + x;
      pixels[newIdx] = oldPixels[oldIdx];
    }
  }
}

// Worker message handler
self.onmessage = (e: MessageEvent<WorkerMessage>) => {
  const msg = e.data;
  
  try {
    switch (msg.type) {
      case 'init':
        initialize(msg.width, msg.height);
        self.postMessage({ type: 'ready' } as WorkerResponse);
        break;
        
      case 'update':
        updatePhysics(msg.dt);
        self.postMessage({ type: 'pixels', data: pixels } as WorkerResponse);
        break;
        
      case 'setPixel':
        setPixel(msg.x, msg.y, msg.pixelType);
        break;
        
      case 'resize':
        resize(msg.width, msg.height);
        break;
    }
  } catch (error) {
    self.postMessage({ 
      type: 'error', 
      message: error instanceof Error ? error.message : 'Unknown error' 
    } as WorkerResponse);
  }
};