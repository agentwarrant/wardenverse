/**
 * PixelDigits - 5x5 pixel art digit patterns for block numbers
 * Matches the Noita-inspired pixel art style of the game
 */

// 5x5 pixel patterns for digits 0-9
// 1 = filled pixel, 0 = empty
const DIGIT_PATTERNS: { [key: string]: number[][] } = {
  '0': [
    [0,1,1,1,0],
    [1,0,0,0,1],
    [1,0,0,0,1],
    [1,0,0,0,1],
    [0,1,1,1,0],
  ],
  '1': [
    [0,0,1,0,0],
    [0,1,1,0,0],
    [0,0,1,0,0],
    [0,0,1,0,0],
    [0,1,1,1,0],
  ],
  '2': [
    [0,1,1,1,0],
    [1,0,0,0,1],
    [0,0,1,1,0],
    [0,1,0,0,0],
    [1,1,1,1,1],
  ],
  '3': [
    [0,1,1,1,0],
    [1,0,0,0,1],
    [0,0,1,1,0],
    [1,0,0,0,1],
    [0,1,1,1,0],
  ],
  '4': [
    [0,0,0,1,0],
    [0,0,1,1,0],
    [0,1,0,1,0],
    [1,1,1,1,1],
    [0,0,0,1,0],
  ],
  '5': [
    [1,1,1,1,1],
    [1,0,0,0,0],
    [1,1,1,1,0],
    [0,0,0,0,1],
    [1,1,1,1,0],
  ],
  '6': [
    [0,1,1,1,0],
    [1,0,0,0,0],
    [1,1,1,1,0],
    [1,0,0,0,1],
    [0,1,1,1,0],
  ],
  '7': [
    [1,1,1,1,1],
    [0,0,0,0,1],
    [0,0,0,1,0],
    [0,0,1,0,0],
    [0,0,1,0,0],
  ],
  '8': [
    [0,1,1,1,0],
    [1,0,0,0,1],
    [0,1,1,1,0],
    [1,0,0,0,1],
    [0,1,1,1,0],
  ],
  '9': [
    [0,1,1,1,0],
    [1,0,0,0,1],
    [0,1,1,1,1],
    [0,0,0,0,1],
    [0,1,1,1,0],
  ],
};

const DIGIT_WIDTH = 5;
const DIGIT_HEIGHT = 5;
const DIGIT_SPACING = 1;// Extra pixel between digits

/**
 * Render a number using pixel art digits
 */
export function renderPixelNumber(
  ctx: CanvasRenderingContext2D,
  num: number,
  x: number,
  y: number,
  pixelScale: number,
  color: string = '#1f2937'
): void {
  const numStr = num.toString();
  const totalWidth = numStr.length * DIGIT_WIDTH + (numStr.length - 1) * DIGIT_SPACING;
  
  // Center the number
  const startX = x - (totalWidth * pixelScale) / 2;
  const startY = y - (DIGIT_HEIGHT * pixelScale) / 2;
  
  ctx.fillStyle = color;
  
  for (let i = 0; i < numStr.length; i++) {
    const digit = numStr[i];
    const pattern = DIGIT_PATTERNS[digit];
    
    if (!pattern) continue;
    
    const digitOffsetX = i * (DIGIT_WIDTH + DIGIT_SPACING) * pixelScale;
    
    for (let py = 0; py < DIGIT_HEIGHT; py++) {
      for (let px = 0; px < DIGIT_WIDTH; px++) {
        if (pattern[py][px] === 1) {
          ctx.fillRect(
            startX + digitOffsetX + px * pixelScale,
            startY + py * pixelScale,
            pixelScale,
            pixelScale
          );
        }
      }
    }
  }
}

/**
 * Calculate the width of a number in pixels (for centering)
 */
export function getPixelNumberWidth(num: number, pixelScale: number): number {
  const numStr = num.toString();
  const totalWidth = numStr.length * DIGIT_WIDTH + (numStr.length - 1) * DIGIT_SPACING;
  return totalWidth * pixelScale;
}

/**
 * Get the height of pixel digits
 */
export function getPixelNumberHeight(pixelScale: number): number {
  return DIGIT_HEIGHT * pixelScale;
}