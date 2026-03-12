/**
 * Wardenverse - Visual Block Explorer
 * Entry point for the application
 */

import { Engine } from './core/Engine';
import { BlockchainDataSource } from './data/BlockchainDataSource';

async function main() {
  const canvas = document.getElementById('main-canvas') as HTMLCanvasElement;
  const loadingEl = document.getElementById('loading');
  const legendEl = document.getElementById('legend');
  const blockHeightEl = document.getElementById('block-height');
  const txCountEl = document.getElementById('tx-count');
  const tpsEl = document.getElementById('tps');

  if (!canvas) {
    console.error('Canvas element not found');
    return;
  }

  // Initialize blockchain data source
  const dataSource = new BlockchainDataSource('https://evm.wardenprotocol.org');
  
  // Initialize the rendering engine
  const engine = new Engine(canvas);
  
  try {
    // Connect to Warden chain
    const connected = await dataSource.connect();
    if (!connected) {
      throw new Error('Failed to connect to Warden chain');
    }

    // Start watching for new blocks
    dataSource.onBlock((block) => {
      engine.addBlock(block);
      
      // Update stats
      if (blockHeightEl) blockHeightEl.textContent = block.number.toLocaleString();
      if (txCountEl) txCountEl.textContent = block.transactions.length.toString();
    });

    dataSource.onTransaction((tx) => {
      engine.addTransaction(tx);
    });

    // Get initial block
    const latestBlock = await dataSource.getLatestBlock();
    if (latestBlock) {
      engine.addBlock(latestBlock);
      if (blockHeightEl) blockHeightEl.textContent = latestBlock.number.toLocaleString();
      if (txCountEl) txCountEl.textContent = latestBlock.transactions.length.toString();
    }

    // Hide loading, show legend
    if (loadingEl) loadingEl.style.display = 'none';
    if (legendEl) legendEl.style.display = 'block';

    // Start the render loop
    engine.start();

    // Calculate TPS every 5 seconds
    let txCount = 0;
    dataSource.onTransaction(() => txCount++);
    setInterval(() => {
      if (tpsEl) tpsEl.textContent = (txCount / 5).toFixed(1);
      txCount = 0;
    }, 5000);

  } catch (error) {
    console.error('Failed to initialize:', error);
    if (loadingEl) {
      loadingEl.innerHTML = `
        <h2 style="color: #ef4444;">Connection Error</h2>
        <p>Could not connect to Warden chain. Please try again later.</p>
        <p style="margin-top: 10px; font-size: 11px; color: #666;">${error}</p>
      `;
    }
  }
}

// Start the application
main().catch(console.error);