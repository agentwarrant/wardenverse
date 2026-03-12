/**
 * Wardenverse - Visual Block Explorer
 * Entry point for the application
 */

import { Engine } from './core/Engine';
import { BlockchainDataSource } from './data/BlockchainDataSource';
import { TransactionType } from './data/BlockchainDataSource';
import { MusicSystem } from './core/MusicSystem';
import { TxHashScroll } from './ui/TxHashScroll';
import { CHAINS, DEFAULT_CHAIN, getChainById, Chain } from './core/Chains';
import { setChainColors } from './visuals/BlockVisual';

async function main() {
  const canvas = document.getElementById('main-canvas') as HTMLCanvasElement;
  const loadingEl = document.getElementById('loading');
  const legendEl = document.getElementById('legend');
  const blockHeightEl = document.getElementById('block-height');
  const blockCountEl = document.getElementById('block-count');
  const totalTxsEl = document.getElementById('total-txs');
  const txCountEl = document.getElementById('tx-count');
  const tpsEl = document.getElementById('tps');

  if (!canvas) {
    console.error('Canvas element not found');
    return;
  }

  // Initialize blockchain data source with default chain (Warden)
  const defaultChain = getChainById(DEFAULT_CHAIN)!;
  
  // Set block colors for the current chain
  setChainColors(defaultChain.colors);
  
  const dataSource = new BlockchainDataSource(defaultChain);
  let currentChain = defaultChain;
  
  // Initialize the rendering engine
  const engine = new Engine(canvas);
  
  // Get the info popup from the engine for TxHashScroll
  const infoPopup = engine.getInfoPopup();
  
  // Initialize the reactive music system
  // House rhythm plays continuously, synth notes triggered by blockchain events
  const musicSystem = new MusicSystem();
  let musicEnabled = false;  // Will be set to true on first interaction
  let musicStarted = false;  // Track if we've successfully started
  
  // Set up background click sound
  engine.setOnBackgroundClick(() => {
    if (musicEnabled) {
      musicSystem.playClickSound();
    }
  });
  
  // Initialize the transaction hash scroll with info popup
  const txHashScroll = new TxHashScroll(infoPopup);
  
  // Track transaction count for TPS calculation
  let txCount = 0;
  let localTxCount = 0; // Transactions counted locally since page load
  let blockCount = 0;
  let chainStatsBaseTotal = 0; // Baseline total from chain stats API or initial config
  
  // Initialize with hardcoded initial total from chain config
  if (currentChain.initialTotalTransactions) {
    chainStatsBaseTotal = currentChain.initialTotalTransactions;
    if (totalTxsEl) totalTxsEl.textContent = chainStatsBaseTotal.toLocaleString();
  }
  
  // Fetch chain stats on startup to get historical total transactions
  const fetchChainStats = async () => {
    const stats = await dataSource.getChainStats();
    if (stats && stats.totalTransactions > 0) {
      // Update base total (API gives us total historical count)
      chainStatsBaseTotal = stats.totalTransactions;
      // Total = base + local transactions counted since load
      const newTotal = chainStatsBaseTotal + localTxCount;
      if (totalTxsEl) totalTxsEl.textContent = newTotal.toLocaleString();
      console.log(`Updated chain stats from API: ${chainStatsBaseTotal.toLocaleString()} historical + ${localTxCount.toLocaleString()} local = ${newTotal.toLocaleString()} total`);
    }
  };
  
  // Try fetching chain stats on startup (will fallback to initial config if API unavailable)
  fetchChainStats();
  
  // Refresh chain stats periodically (every 5 minutes)
  setInterval(fetchChainStats, 5 * 60 * 1000);
  
  // Handle legend info popup clicks
  document.addEventListener('showLegendInfo', ((e: CustomEvent) => {
    infoPopup.showLegendInfo(e.detail);
  }) as EventListener);
  
  // Function to start music (handles browser autoplay policy)
  const startMusic = async () => {
    if (musicStarted) return;  // Already started
    try {
      await musicSystem.start();
      musicStarted = true;
      musicEnabled = true;
      const btn = document.getElementById('music-toggle');
      if (btn) btn.innerHTML = '🔊 Music';
    } catch (e) {
      console.log('Music start failed:', e);
    }
  };
  
  // Function to toggle music
  const toggleMusic = async () => {
    if (musicEnabled) {
      musicSystem.stop();
      musicEnabled = false;
      const btn = document.getElementById('music-toggle');
      if (btn) btn.innerHTML = '🔇 Music';
    } else {
      await startMusic();
    }
  };
  
  // Function to switch chains
  const switchChain = async (chainId: string) => {
    if (chainId === currentChain.id) return;
    
    const newChain = getChainById(chainId);
    if (!newChain) {
      console.error(`Unknown chain: ${chainId}`);
      return;
    }
    
    // Show loading state
    if (loadingEl) {
      loadingEl.innerHTML = `
        <div class="spinner"></div>
        <h2>Switching to ${newChain.name}...</h2>
        <p>Connecting to ${newChain.name} chain...</p>
      `;
      loadingEl.style.display = 'flex';
    }
    
    // Clear the engine state
    engine.clear();
    
    // Reset stats
    if (blockHeightEl) blockHeightEl.textContent = '--';
    if (blockCountEl) blockCountEl.textContent = '0';
    if (totalTxsEl) totalTxsEl.textContent = '0';
    if (txCountEl) txCountEl.textContent = '--';
    if (tpsEl) tpsEl.textContent = '--';
    txCount = 0;
    localTxCount = 0;
    blockCount = 0;
    chainStatsBaseTotal = 0;
    
    // Clear the tx hash scroll
    txHashScroll.clear();
    
    // Switch the chain
    const connected = await dataSource.switchChain(chainId);
    if (!connected) {
      if (loadingEl) {
        loadingEl.innerHTML = `
          <h2 style="color: #ef4444;">Connection Error</h2>
          <p>Could not connect to ${newChain.name} chain. Please try again.</p>
        `;
      }
      return;
    }
    
    currentChain = newChain;
    
    // Update chain label text
    const chainLabel = document.getElementById('chain-label');
    if (chainLabel) {
      chainLabel.textContent = newChain.name;
    }
    
    // Get initial block from new chain
    const latestBlock = await dataSource.getLatestBlock();
    if (latestBlock) {
      engine.addBlock(latestBlock);
      blockCount = 1;
      if (blockHeightEl) blockHeightEl.textContent = latestBlock.number.toLocaleString();
      if (blockCountEl) blockCountEl.textContent = '1';
      if (txCountEl) txCountEl.textContent = latestBlock.transactions.length.toString();
      
      // Fetch chain stats for the new chain and update total
      const stats = await dataSource.getChainStats();
      if (stats && stats.totalTransactions > 0) {
        chainStatsBaseTotal = stats.totalTransactions;
      }
      
      // Count this block's transactions locally
      localTxCount = latestBlock.transactions.length;
      const displayTotal = chainStatsBaseTotal + localTxCount;
      if (totalTxsEl) totalTxsEl.textContent = displayTotal.toLocaleString();
    }
    
    // Hide loading
    if (loadingEl) loadingEl.style.display = 'none';
    
    // Update the loading message for future reference
    const loadingMessage = document.querySelector('#loading h2');
    if (loadingMessage) {
      loadingMessage.textContent = 'Connecting...';
    }
    const loadingSubtext = document.querySelector('#loading p');
    if (loadingSubtext) {
      loadingSubtext.textContent = 'Initializing the universe...';
    }
    
    console.log(`Switched to ${newChain.name}`);
  };
  
  // Add chain label to header (before music button)
  // Note: Chain switcher hidden for now - only Warden is available
  const header = document.getElementById('header');
  if (header) {
    // Create chain label (static since we only have Warden)
    const chainLabel = document.createElement('div');
    chainLabel.id = 'chain-label';
    chainLabel.style.cssText = `
      background: rgba(30, 30, 45, 0.8);
      border: 1px solid rgba(251, 191, 36, 0.3);
      color: #fbbf24;
      padding: 6px 14px;
      border-radius: 8px;
      font-size: 12px;
      font-family: inherit;
      font-weight: 500;
      margin-right: 10px;
    `;
    chainLabel.textContent = currentChain.name;
    header.appendChild(chainLabel);
    
    // Create a container for the music button and animation
    const musicContainer = document.createElement('div');
    musicContainer.id = 'music-container';
    musicContainer.style.cssText = `
      display: flex;
      align-items: center;
      gap: 0;
      margin-left: 10px;
      position: relative;
    `;
    
    const musicBtn = document.createElement('button');
    musicBtn.id = 'music-toggle';
    musicBtn.innerHTML = '🔊 Music';  // Show as ON by default (will start on first click anywhere)
    musicBtn.style.cssText = `
      background: rgba(30, 30, 45, 0.8);
      border: 1px solid rgba(100, 100, 150, 0.3);
      color: #e0e0e0;
      padding: 6px 14px;
      border-radius: 8px;
      cursor: pointer;
      font-size: 12px;
      font-family: inherit;
      transition: all 0.2s ease;
    `;
    musicBtn.onmouseover = () => {
      musicBtn.style.background = 'rgba(50, 50, 70, 0.9)';
    };
    musicBtn.onmouseout = () => {
      musicBtn.style.background = 'rgba(30, 30, 45, 0.8)';
    };
    
    // Create pixel-style "Press here" animation
    const pressHere = document.createElement('div');
    pressHere.id = 'press-here-animation';
    pressHere.innerHTML = '► Press here';
    pressHere.style.cssText = `
      background: linear-gradient(135deg, #fbbf24, #f59e0b);
      color: #1a1a2e;
      padding: 4px 8px;
      border-radius: 4px;
      font-size: 10px;
      font-family: 'Press Start 2P', monospace, system-ui;
      font-weight: bold;
      letter-spacing: 0.5px;
      margin-left: -4px;
      border: 2px solid #fcd34d;
      box-shadow: 
        2px 2px 0 #92400e,
        0 0 10px rgba(251, 191, 36, 0.5);
      animation: pixel-blink 0.8s step-end infinite;
      cursor: pointer;
      user-select: none;
      text-transform: uppercase;
      position: relative;
      z-index: 1;
    `;
    
    // Add pixel-style blinking animation CSS
    const styleSheet = document.createElement('style');
    styleSheet.textContent = `
      @keyframes pixel-blink {
        0%, 50% {
          opacity: 1;
          transform: translateX(0);
        }
        51%, 100% {
          opacity: 0.3;
          transform: translateX(-2px);
        }
      }
      
      @keyframes pixel-pulse {
        0%, 100% {
          box-shadow: 
            2px 2px 0 #92400e,
            0 0 10px rgba(251, 191, 36, 0.5);
        }
        50% {
          box-shadow: 
            2px 2px 0 #92400e,
            0 0 20px rgba(251, 191, 36, 0.8),
            0 0 30px rgba(251, 191, 36, 0.4);
        }
      }
      
      #press-here-animation {
        animation: pixel-blink 0.8s step-end infinite, pixel-pulse 1.5s ease-in-out infinite;
      }
      
      @media (hover: hover) {
        #press-here-animation:hover {
          animation: pixel-blink 0.4s step-end infinite, pixel-pulse 0.75s ease-in-out infinite;
        }
      }
    `;
    document.head.appendChild(styleSheet);
    
    // Function to remove the animation
    const removePressHere = () => {
      if (pressHere && pressHere.parentNode) {
        pressHere.style.animation = 'none';
        pressHere.style.opacity = '0';
        pressHere.style.transform = 'scale(0.8)';
        pressHere.style.transition = 'all 0.2s ease-out';
        setTimeout(() => {
          if (pressHere && pressHere.parentNode) {
            pressHere.parentNode.removeChild(pressHere);
          }
        }, 200);
      }
    };
    
    // Clicking the animation also starts music
    pressHere.onclick = async (e) => {
      e.stopPropagation();
      await startMusic();
      removePressHere();
    };
    
    musicBtn.onclick = async (e) => {
      e.stopPropagation();  // Prevent double-toggle from document listener
      await toggleMusic();
      removePressHere();
    };
    
    musicContainer.appendChild(musicBtn);
    musicContainer.appendChild(pressHere);
    header.appendChild(musicContainer);
    
    // Remove animation when music starts (from any interaction)
    const originalStartMusic = startMusic;
    const startMusicWithRemove = async () => {
      await originalStartMusic();
      removePressHere();
    };
    // Override the startMusic reference to also remove animation
    (window as any).__removePressHere = removePressHere;
  }
  
  // Auto-start music on FIRST user interaction anywhere on the page
  // This is required by browser autoplay policies - audio needs user gesture
  const startOnFirstInteraction = async () => {
    await startMusic();
    // Remove the "Press here" animation
    const pressHereEl = document.getElementById('press-here-animation');
    if (pressHereEl && pressHereEl.parentNode) {
      pressHereEl.style.animation = 'none';
      pressHereEl.style.opacity = '0';
      pressHereEl.style.transform = 'scale(0.8)';
      pressHereEl.style.transition = 'all 0.2s ease-out';
      setTimeout(() => {
        if (pressHereEl && pressHereEl.parentNode) {
          pressHereEl.parentNode.removeChild(pressHereEl);
        }
      }, 200);
    }
    // Remove listeners after first interaction
    document.removeEventListener('click', startOnFirstInteraction);
    document.removeEventListener('keydown', startOnFirstInteraction);
    document.removeEventListener('touchstart', startOnFirstInteraction);
  };
  document.addEventListener('click', startOnFirstInteraction, { once: true });
  document.addEventListener('keydown', startOnFirstInteraction, { once: true });
  document.addEventListener('touchstart', startOnFirstInteraction, { once: true });
  
  try {
    // Connect to default chain (Warden)
    const connected = await dataSource.connect();
    if (!connected) {
      throw new Error(`Failed to connect to ${currentChain.name} chain`);
    }

    // Start watching for new blocks
    dataSource.onBlock((block) => {
      engine.addBlock(block);
      blockCount++;
      
      // Update stats
      if (blockHeightEl) blockHeightEl.textContent = block.number.toLocaleString();
      if (blockCountEl) blockCountEl.textContent = blockCount.toLocaleString();
      if (txCountEl) txCountEl.textContent = block.transactions.length.toString();
      
      // Update total transactions: increment local count and calculate total
      localTxCount += block.transactions.length;
      const displayTotal = chainStatsBaseTotal + localTxCount;
      if (totalTxsEl) totalTxsEl.textContent = displayTotal.toLocaleString();
      
      // Play block sound and big event sound for blocks with many transactions
      if (musicEnabled) {
        musicSystem.playBlockSound();
        if (block.transactions.length >= 5) {
          musicSystem.playBigEventSound();
        }
      }
    });

    dataSource.onTransaction((tx) => {
      engine.addTransaction(tx);
      
      // Add to the tx hash scroll with full transaction data
      txHashScroll.addTransaction(tx);
      
      // Play transaction sound based on type
      if (musicEnabled) {
        musicSystem.playTransactionSound(tx.type);
      }
    });

    // Get initial block
    const latestBlock = await dataSource.getLatestBlock();
    if (latestBlock) {
      engine.addBlock(latestBlock);
      blockCount = 1;
      if (blockHeightEl) blockHeightEl.textContent = latestBlock.number.toLocaleString();
      if (blockCountEl) blockCountEl.textContent = '1';
      if (txCountEl) txCountEl.textContent = latestBlock.transactions.length.toString();
      
      // Update total transactions: count this block's transactions locally
      localTxCount = latestBlock.transactions.length;
      const displayTotal = chainStatsBaseTotal + localTxCount;
      if (totalTxsEl) totalTxsEl.textContent = displayTotal.toLocaleString();
    }

    // Hide loading, show legend
    if (loadingEl) loadingEl.style.display = 'none';
    if (legendEl) legendEl.style.display = 'block';

    // Start the render loop
    engine.start();

    // Calculate TPS every 5 seconds
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
        <p>Could not connect to ${currentChain.name} chain. Please try again later.</p>
        <p style="margin-top: 10px; font-size: 11px; color: #666;">${error}</p>
      `;
    }
  }
}

// Start the application
main().catch(console.error);