/**
 * BurnOMeter - Pixel art flame display for burned WARD tokens
 * Shows the balance of the zero address (burn address) in millions
 * With animated pixel flame matching Noita-style visuals
 */

import { JsonRpcProvider } from 'ethers';

// ERC-20 ABI for balanceOf
const ERC20_ABI = [
'function balanceOf(address) view returns (uint256)'
];

// WARD token address on Warden chain
const WARD_TOKEN_ADDRESS = '0x0000000000000000000000000000000000000000';

// Burn address (zeroaddress)
const BURN_ADDRESS = '0x0000000000000000000000000000000000000000';

export class BurnOMeter {
private container: HTMLDivElement;
private flameCanvas: HTMLCanvasElement;
private flameCtx: CanvasRenderingContext2D;
private valueElement: HTMLDivElement;
private provider: JsonRpcProvider | null = null;
private rpcUrl: string;
private balance: bigint = 0n;
private displayBalance: number = 0;
private targetBalance: number = 0;
private animationFrame: number | null = null;
private flameFrame: number = 0;
private isRunning: boolean = false;

// Pixel flame animation state
private flamePixels: Array<{
x: number;
y: number;
vy: number;
life: number;
maxLife: number;
color: [number, number, number];
size: number;
}> = [];

constructor(rpcUrl: string) {
this.rpcUrl = rpcUrl;

// Create main container
this.container = document.createElement('div');
this.container.id = 'burn-o-meter';
this.container.innerHTML = `
<div class="burn-header">
<span class="burn-icon">🔥</span>
<span class="burn-title">BURN-O-METER</span>
</div>
<div class="burn-content">
<canvas class="flame-canvas" width="64" height="48"></canvas>
<div class="burn-value-container">
<div class="burn-value">0.0M</div>
<div class="burn-label">WARD burned</div>
</div>
</div>
`;

// Add styles
this.addStyles();

// Get canvas and context
this.flameCanvas = this.container.querySelector('.flame-canvas') as HTMLCanvasElement;
this.flameCtx = this.flameCanvas.getContext('2d')!;

// Get value element
this.valueElement = this.container.querySelector('.burn-value') as HTMLDivElement;

// Attach to DOM
this.attachToDOM();
}

/**
 * Set the RPC URL and reinitialize provider
 */
setRpcUrl(url: string): void {
this.rpcUrl = url;
this.provider = null;
if (this.isRunning) {
this.initProvider();
}
}

/**
 * Initialize the ethers provider
 */
private async initProvider(): Promise<void> {
if (!this.provider) {
this.provider = new JsonRpcProvider(this.rpcUrl);
}
}

/**
 * Start fetching burn balance
 */
async start(): Promise<void> {
this.isRunning = true;
await this.initProvider();

// Initial fetch
await this.fetchBalance();

// Poll every 30 seconds
setInterval(() => this.fetchBalance(), 30000);

// Start animations
this.startFlameAnimation();
this.startValueAnimation();
}

/**
 * Fetch the balance of the burn address
 */
private async fetchBalance(): Promise<void> {
if (!this.provider) return;

try {
// The zero address on Warden chain holds burned WARD
// We query the native balance (WARD is the native token)
const balance = await this.provider.getBalance(BURN_ADDRESS);
this.balance = balance;
this.targetBalance = Number(balance) / 1e18; // Convert from wei to WARD
console.log(`Burn balance: ${this.targetBalance.toLocaleString()} WARD`);
} catch (error) {
console.error('Error fetching burn balance:', error);
}
}

/**
 * Animate the displayed value smoothly
 */
private startValueAnimation(): void {
const animate = () => {
// Smooth interpolation towards target
const diff = this.targetBalance - this.displayBalance;
this.displayBalance += diff * 0.05;

// Format in millions
const millions = this.displayBalance / 1_000_000;
this.valueElement.textContent = `${millions.toFixed(1)}M`;

this.animationFrame = requestAnimationFrame(animate);
};

animate();
}

/**
 * Animate the pixel flame
 */
private startFlameAnimation(): void {
const animate = () => {
this.flameFrame++;
this.updateFlame();
this.renderFlame();
requestAnimationFrame(animate);
};

animate();
}

/**
 * Update flame particle state
 */
private updateFlame(): void {
// Spawn new flame particles
if (this.flameFrame % 2 === 0) {
const x = 32 + (Math.random() - 0.5) * 30;
this.flamePixels.push({
x,
y: 48,
vy: -1 - Math.random() * 2,
life: 40 + Math.random() * 20,
maxLife: 60,
color: this.getFlameColor(),
size: 2 + Math.random() * 3
});
}

// Update existing particles
this.flamePixels = this.flamePixels.filter(p => {
p.x += (Math.random() - 0.5) * 1.5;
p.y += p.vy;
p.life--;
p.vy *= 0.98;
return p.life > 0;
});

// Limit particle count
if (this.flamePixels.length > 100) {
this.flamePixels = this.flamePixels.slice(-100);
}
}

/**
 * Get a flame color (orange to yellow gradient)
 */
private getFlameColor(): [number, number, number] {
const colors: [number, number, number][] = [
[255, 100, 0],// Orange-red
[255, 140, 0], // Dark orange
[255, 165, 0], // Orange
[255, 200, 0], // Yellow-orange
[255, 220, 50], // Yellow
[255, 255, 100], // Light yellow
];
return colors[Math.floor(Math.random() * colors.length)];
}

/**
 * Render the flame to canvas
 */
private renderFlame(): void {
const ctx = this.flameCtx;
const width = this.flameCanvas.width;
const height = this.flameCanvas.height;

// Clear with transparency
ctx.clearRect(0, 0, width, height);

// Draw glow effect at base
const glowGradient = ctx.createRadialGradient(32, 48, 0, 32, 48, 40);
glowGradient.addColorStop(0, 'rgba(255, 150, 0, 0.3)');
glowGradient.addColorStop(0.5, 'rgba(255, 100, 0, 0.15)');
glowGradient.addColorStop(1, 'transparent');
ctx.fillStyle = glowGradient;
ctx.fillRect(0, 0, width, height);

// Disable smoothing for pixel art
ctx.imageSmoothingEnabled = false;

// Draw particles as pixel squares
for (const p of this.flamePixels) {
const alpha = Math.min(1, p.life / p.maxLife);
const size = Math.max(1, Math.floor(p.size * alpha));
const pixelX = Math.floor(p.x);
const pixelY = Math.floor(p.y);

// Color with alpha
const r = p.color[0];
const g = p.color[1];
const b = p.color[2];
ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${alpha})`;

// Draw pixelated square
ctx.fillRect(pixelX - size/2, pixelY - size/2, size, size);

// Add bright core for some particles
if (p.life > p.maxLife * 0.6 && Math.random() > 0.7) {
ctx.fillStyle = `rgba(255, 255, 200, ${alpha * 0.8})`;
ctx.fillRect(pixelX, pixelY, 1, 1);
}
}

// Draw base ember glow
for (let i = 0; i < 8; i++) {
const x = 20 + i * 4 + (Math.random() - 0.5) * 2;
const y = 46 + (Math.random() - 0.5) * 2;
const brightness = 150 + Math.random() * 105;
ctx.fillStyle = `rgb(${brightness}, ${brightness * 0.4}, 0)`;
ctx.fillRect(x, y, 2, 2);
}
}

/**
 * Add CSS styles for the component
 */
private addStyles(): void {
const style = document.createElement('style');
style.textContent = `
#burn-o-meter {
position: fixed;
bottom: 20px;
left: 20px;
background: rgba(10, 10, 20, 0.95);
border: 2px solid rgba(255, 100, 0, 0.5);
border-radius: 8px;
padding: 0;
font-family: 'Press Start 2P', monospace;
z-index: 90;
min-width: 180px;
box-shadow: 
  0 0 20px rgba(255, 100, 0, 0.2),
  0 0 40px rgba(255, 50, 0, 0.1),
  inset 0 1px 0 rgba(255, 255, 255, 0.05);
image-rendering: pixelated;
backdrop-filter: blur(10px);
}

.burn-header {
display: flex;
align-items: center;
gap: 8px;
padding: 10px 14px;
background: linear-gradient(180deg, rgba(255, 100, 0, 0.2) 0%, rgba(255, 50, 0, 0.1) 100%);
border-bottom: 1px solid rgba(255, 100, 0, 0.3);
}

.burn-icon {
font-size: 14px;
filter: drop-shadow(0 0 4px rgba(255, 100, 0, 0.8));
animation: flame-flicker 0.15s step-end infinite;
}

@keyframes flame-flicker {
0%, 100% { opacity: 1; transform: translateY(0); }
50% { opacity: 0.9; transform: translateY(-1px); }
}

.burn-title {
font-size: 7px;
color: #ff9500;
text-transform: uppercase;
letter-spacing: 1px;
text-shadow: 0 0 10px rgba(255, 149, 0, 0.5);
}

.burn-content {
display: flex;
align-items: center;
gap: 10px;
padding: 12px 14px;
}

.flame-canvas {
width: 64px;
height: 48px;
image-rendering: pixelated;
image-rendering: crisp-edges;
filter: drop-shadow(0 0 8px rgba(255, 100, 0, 0.4));
}

.burn-value-container {
display: flex;
flex-direction: column;
gap: 4px;
}

.burn-value {
font-size: 14px;
font-weight: bold;
color: #ff9500;
text-shadow: 
  0 0 10px rgba(255, 149, 0, 0.8),
  0 0 20px rgba(255, 100, 0, 0.4);
letter-spacing: 1px;
}

.burn-label {
font-size: 6px;
color: #888;
text-transform: uppercase;
letter-spacing: 0.5px;
}

/* Mobile responsive */
@media (max-width: 768px) {
#burn-o-meter {
bottom: auto;
top: 85px;
left: 5px;
right: auto;
min-width: 110px;
}

.burn-header {
padding: 6px 8px;
gap: 6px;
}

.burn-icon {
font-size: 10px;
}

.burn-title {
font-size: 5px;
letter-spacing: 0.5px;
}

.burn-content {
padding: 6px 8px;
gap: 8px;
}

.flame-canvas {
width: 36px;
height: 28px;
}

.burn-value {
font-size: 10px;
}

.burn-label {
font-size: 4px;
}
}

@media (max-width: 480px) {
#burn-o-meter {
top: 80px;
left: 4px;
min-width: 100px;
}

.burn-header {
padding: 4px6px;
gap: 4px;
}

.burn-icon {
font-size: 8px;
}

.burn-title {
font-size: 4px;
letter-spacing: 0.3px;
}

.burn-content {
padding: 4px 6px;
gap: 6px;
}

.flame-canvas {
width: 28px;
height: 22px;
}

.burn-value {
font-size: 9px;
}

.burn-label {
font-size: 3px;
}
}

/* Landscape mobile */
@media (max-width: 896px) and (orientation: landscape) {
#burn-o-meter {
top: 60px;
left: 8px;
bottom: auto;
min-width: 100px;
}

.burn-header {
padding: 4px 6px;
gap: 4px;
}

.burn-icon {
font-size: 8px;
}

.burn-title {
font-size: 4px;
}

.burn-content {
padding: 4px 6px;
gap: 6px;
}

.flame-canvas {
width: 32px;
height: 24px;
}

.burn-value {
font-size: 9px;
}

.burn-label {
font-size: 3px;
}
}
`;
document.head.appendChild(style);
}

/**
 * Attach the component to the DOM
 */
private attachToDOM(): void {
const canvasContainer = document.getElementById('canvas-container');
if (canvasContainer) {
canvasContainer.appendChild(this.container);
} else {
document.body.appendChild(this.container);
}
}

/**
 * Remove the component from DOM
 */
destroy(): void {
if (this.animationFrame) {
cancelAnimationFrame(this.animationFrame);
}
if (this.container.parentNode) {
this.container.parentNode.removeChild(this.container);
}
}

/**
 * Get the current burn balance in WARD
 */
getBalance(): bigint {
return this.balance;
}

/**
 * Get the burn balance in millions
 */
getBalanceInMillions(): number {
return Number(this.balance) / 1e18 / 1_000_000;
}
}