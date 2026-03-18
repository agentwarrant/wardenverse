/**
 * AgentTicker - Scrolling ticker showing active agents with proof of inferences
 * Displays agent names in a horizontal scrolling bar at the bottom of the screen
 * Listens to blockchain events from the ProofOfInference contract for real-time activity
 */

import { JsonRpcProvider, Log } from 'ethers';

// Main production agent IDs and their names
const PRODUCTION_AGENTS: Record<string, string> = {
  '1000001': 'Kaibot',
  '1000002': 'Messari',
  '1000003': 'WachAI',
  '1000004': 'Uniswap',
  '1000005': 'deBridge',
  '1000006': 'BaseFarmer',
  '1000007': 'EVMagent',
  '1000008': 'SolanaAgent',
  '1000009': 'WardenDocs',
  '1000010': 'ImageGen',
  '1000011': 'Jupiter',
  '1000013': 'Levva',
  '1000014': 'DCA',
  '1000015': 'CoinGecko',
  '1000016': 'Portfolio Analysis',
  '10000012': 'Warden Agent'
};

// ProofOfInference contract address on Warden
const PROOF_OF_INFERENCE_ADDRESS = '0x510b5Df4612380c6564320d7DbbfdBe72AC0d529';

// Event signature for ProofOfInference events
const PROOF_EVENT_SIGNATURE = '0x7dd42a288b7714ed6477ef2647c0f2d2a1b063619ea6c4761a4a5f01d3429609';

interface AgentActivity {
  id: string;
  name: string;
  lastActivity: number;
  txHash: string;
}

export class AgentTicker {
  private container: HTMLDivElement;
  private tickerContent: HTMLDivElement;
  private rpcUrl: string;
  private provider: JsonRpcProvider | null = null;
  private activityWindowMs: number = 180000; // Show agents active in last 3 minutes
  private maxAgents: number = 15; // Maximum agents to show in ticker
  private recentAgents: AgentActivity[] = []; // Ordered list of recent agents (newest first)
  private isRunning: boolean = false;
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private animationStarted: boolean = false;
  private lastBlockNumber: number = 0;

  constructor(rpcUrl: string = 'https://evm.wardenprotocol.org') {
    this.rpcUrl = rpcUrl;

    // Create main container
    this.container = document.createElement('div');
    this.container.id = 'agent-ticker-container';
    this.container.style.cssText = `
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      z-index: 45;
      pointer-events: none;
      font-family: 'Press Start 2P', monospace;
    `;

    // Create ticker frame
    const frame = document.createElement('div');
    frame.style.cssText = `
      background: linear-gradient(180deg, rgba(15, 15, 25, 0.95) 0%, rgba(10, 10, 20, 0.98) 100%);
      border-top: 2px solid rgba(255, 80, 60, 0.5);
      box-shadow: 
        0 -2px 20px rgba(255, 80, 60, 0.2),
        0 0 40px rgba(255, 120, 80, 0.1),
        inset 0 1px 0 rgba(255, 255, 255, 0.05);
      padding: 10px 0;
      overflow: hidden;
      position: relative;
      min-height: 30px;
    `;

    // Create fade mask on the left side - hides content before it reaches the header
    const fadeMask = document.createElement('div');
    fadeMask.id = 'agent-ticker-fade-mask';
    fadeMask.style.cssText = `
      position: absolute;
      left: 0;
      top: 0;
      bottom: 0;
      width: 360px;
      background: linear-gradient(90deg, 
        rgba(10, 10, 20, 1) 0%, 
        rgba(10, 10, 20, 1) 240px,
        rgba(10, 10, 20, 0.9) 280px,
        rgba(10, 10, 20, 0.5) 320px,
        transparent 360px
      );
      z-index: 5;
      pointer-events: none;
    `;
    frame.appendChild(fadeMask);

    // Create header/label - position to the right of BurnOMeter (which is at left:20px, min-width:180px)
    const headerContainer = document.createElement('div');
    headerContainer.className = 'agent-ticker-header';
    headerContainer.style.cssText = `
      position: absolute;
      left: 200px;
      top: 0;
      bottom: 0;
      background: rgba(10, 10, 20, 1);
      padding: 10px 15px;
      z-index: 10;
      display: flex;
      align-items: center;
      border-right: 2px solid rgba(255, 80, 60, 0.5);
    `;

    const headerLabel = document.createElement('span');
    headerLabel.innerHTML = `<span style="color: #ff503c;">⚡</span> PROOF OF INFERENCE`;
    headerLabel.style.cssText = `
      font-size: 8px;
      color: #ff7850;
      letter-spacing: 1px;
      text-shadow: 0 0 10px rgba(255, 80, 60, 0.5);
      white-space: nowrap;
    `;
    headerContainer.appendChild(headerLabel);

    // Create scrolling content area - starts after header, scrolls left to right
    this.tickerContent = document.createElement('div');
    this.tickerContent.id = 'agent-ticker-content';
    this.tickerContent.style.cssText = `
      display: flex;
      align-items: center;
      gap: 24px;
      padding-left: 450px;
      padding-right: 50px;
      white-space: nowrap;
      min-height: 24px;
    `;

    // Add CSS animations
    const styleSheet = document.createElement('style');
    styleSheet.textContent = `
      @keyframes scroll-ticker-left {
        0% {
          transform: translateX(0);
        }
        100% {
          transform: translateX(-50%);
        }
      }
      
      @keyframes agent-glow {
        0%, 100% {
          text-shadow: 0 0 8px var(--glow-color);
        }
        50% {
          text-shadow: 0 0 15px var(--glow-color), 0 0 25px var(--glow-color);
        }
      }
      
      @keyframes agent-appear {
        0% {
          opacity: 0;
          transform: scale(0.8) translateY(5px);
        }
        100% {
          opacity: 1;
          transform: scale(1) translateY(0);
        }
      }
      
      @keyframes pulse-dot {
        0%, 100% {
          opacity: 1;
          transform: scale(1);
        }
        50% {
          opacity: 0.5;
          transform: scale(0.8);
        }
      }
      
      .agent-ticker-item {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        padding: 4px 12px;
        background: rgba(255, 80, 60, 0.1);
        border: 1px solid rgba(255, 80, 60, 0.3);
        border-radius: 4px;
        animation: agent-appear 0.3s ease-out;
        transition: all 0.2s ease;
      }
      
      .agent-ticker-dot {
        width: 6px;
        height: 6px;
        border-radius: 50%;
        background: #ff503c;
        box-shadow: 0 0 8px #ff503c;
        animation: pulse-dot 1.5s ease-in-out infinite;
      }
      
      .agent-ticker-name {
        font-size: 9px;
        color: #ffa064;
        letter-spacing: 0.5px;
        --glow-color: rgba(255, 160, 100, 0.6);
        animation: agent-glow 2s ease-in-out infinite;
      }
      
      /* Mobile responsive - BurnOMeter moves to top on mobile, so ticker can use full width */
      @media (max-width: 768px) {
        #agent-ticker-container {
          font-size: 7px;
        }

        .agent-ticker-item {
          padding: 3px 8px;
          gap: 6px;
        }

        .agent-ticker-name {
          font-size: 7px;
        }

        .agent-ticker-dot {
          width: 4px;
          height: 4px;
        }

        #agent-ticker-content {
          padding-left: 160px;
          gap: 16px;
        }

        .agent-ticker-header {
          left: 10px !important;
        }
        
        #agent-ticker-fade-mask {
          width: 100px !important;
        }
      }

      @media (max-width: 480px) {
        #agent-ticker-container {
          font-size: 6px;
        }

        .agent-ticker-item {
          padding: 2px 6px;
          gap: 4px;
        }

        .agent-ticker-name {
          font-size: 6px;
        }

        .agent-ticker-dot {
          width: 3px;
          height: 3px;
        }

        #agent-ticker-content {
          padding-left: 140px;
          gap: 12px;
        }
      }
    `;
    document.head.appendChild(styleSheet);

    // Assemble
    frame.appendChild(headerContainer);
    frame.appendChild(this.tickerContent);
    this.container.appendChild(frame);

    // Add to page - try canvas-container first, then body
    const canvasContainer = document.getElementById('canvas-container');
    if (canvasContainer) {
      canvasContainer.appendChild(this.container);
      console.log('AgentTicker: Added to canvas-container');
    } else {
      document.body.appendChild(this.container);
      console.log('AgentTicker: Added to body');
    }

    // Show initial state with header visible
    this.showWaitingState();

    console.log('AgentTicker: Component created and added to DOM');
  }

  /**
   * Start listening for blockchain events
   */
  async start(): Promise<void> {
    if (this.isRunning) return;
    this.isRunning = true;

    try {
      // Initialize provider
      this.provider = new JsonRpcProvider(this.rpcUrl);
      
      // Get current block number
      this.lastBlockNumber = await this.provider.getBlockNumber();
      console.log('AgentTicker: Starting from block', this.lastBlockNumber);

      // Initial fetch of recent events
      await this.fetchRecentEvents();

      // Set up polling for new events every 6 seconds (block time is ~6s)
      this.pollTimer = setInterval(() => {
        this.fetchRecentEvents().catch(err => {
          console.error('AgentTicker: Poll error:', err);
        });
      }, 6000);

      console.log('AgentTicker: Started listening for proof of inference events');
    } catch (error) {
      console.error('AgentTicker: Failed to start:', error);
      this.showErrorState(error instanceof Error ? error.message : 'Connection failed');
    }
  }

  /**
   * Stop polling
   */
  stop(): void {
    this.isRunning = false;
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }

  /**
   * Fetch recent ProofOfInference events from blockchain
   */
  private async fetchRecentEvents(): Promise<void> {
    if (!this.provider) return;

    try {
      const currentBlock = await this.provider.getBlockNumber();
      
      // Only fetch new blocks since last check
      if (currentBlock <= this.lastBlockNumber) {
        return;
      }

      // Limit to last 100 blocks to avoid RPC limits
      const fromBlock = Math.max(this.lastBlockNumber + 1, currentBlock - 100);
      
      console.log('AgentTicker: Fetching events from block', fromBlock, 'to', currentBlock);

      // Query for ProofOfInference events
      const filter = {
        address: PROOF_OF_INFERENCE_ADDRESS,
        fromBlock: fromBlock,
        toBlock: currentBlock,
        topics: [PROOF_EVENT_SIGNATURE]
      };

      const logs = await this.provider.getLogs(filter);
      console.log('AgentTicker: Found', logs.length, 'proof events');

      // Process each event
      for (const log of logs) {
        this.processEvent(log);
      }

      // Update last block number
      this.lastBlockNumber = currentBlock;

      // Update display
      this.render();

    } catch (error) {
      console.error('AgentTicker: Error fetching events:', error);
      // Don't show error state for temporary failures
    }
  }

  /**
   * Process a single ProofOfInference event
   */
  private processEvent(log: Log): void {
    // Agent ID is in topics[2] (third topic)
    // Format: 0x00000000000000000000000000000000000000000000000000000000000f4247
    if (!log.topics || log.topics.length < 3) {
      return;
    }

    try {
      // Extract agent ID from topics[2]
      const agentIdHex = log.topics[2];
      const agentId = parseInt(agentIdHex, 16).toString();

      // Only track known production agents
      const agentName = PRODUCTION_AGENTS[agentId];
      if (!agentName) {
        // Unknown agent, skip
        return;
      }

      const now = Date.now();
      const txHash = log.transactionHash;

      // Check if this agent is already in our recent list
      const existingIndex = this.recentAgents.findIndex(a => a.id === agentId);
      
      if (existingIndex >= 0) {
        // Remove from current position
        const existing = this.recentAgents.splice(existingIndex, 1)[0];
        // Update and add to front
        this.recentAgents.unshift({
          ...existing,
          lastActivity: now,
          txHash
        });
      } else {
        // Add new agent to front
        this.recentAgents.unshift({
          id: agentId,
          name: agentName,
          lastActivity: now,
          txHash
        });
      }

      // Keep only the last maxAgents
      if (this.recentAgents.length > this.maxAgents) {
        this.recentAgents = this.recentAgents.slice(0, this.maxAgents);
      }

      console.log('AgentTicker: Agent', agentName, '(ID:', agentId, ') active - tx:', txHash.slice(0, 10) + '...');

    } catch (error) {
      console.error('AgentTicker: Error processing event:', error);
    }
  }

  /**
   * Show waiting state while fetching data
   */
  private showWaitingState(): void {
    this.tickerContent.innerHTML = '';
    const waiting = document.createElement('span');
    waiting.style.cssText = `
      color: rgba(255, 160, 100, 0.5);
      font-size: 9px;
      letter-spacing: 1px;
      padding-left: 20px;
    `;
    waiting.textContent = 'Listening for agent activity...';
    this.tickerContent.appendChild(waiting);
    this.tickerContent.style.animation = 'none';
  }

  /**
   * Show error state when fetch fails
   */
  private showErrorState(message: string): void {
    this.tickerContent.innerHTML = '';
    const errorEl = document.createElement('span');
    errorEl.style.cssText = `
      color: rgba(255, 100, 100, 0.7);
      font-size: 8px;
      letter-spacing: 1px;
      padding-left: 20px;
    `;
    errorEl.textContent = `Error: ${message.substring(0, 30)}`;
    this.tickerContent.appendChild(errorEl);
    this.tickerContent.style.animation = 'none';
  }

  /**
   * Remove agents that are older than the activity window
   */
  private pruneInactiveAgents(): void {
    const cutoff = Date.now() - this.activityWindowMs;
    this.recentAgents = this.recentAgents.filter(agent => agent.lastActivity >= cutoff);
  }

  /**
   * Render the ticker content - rebuild with duplicated content for seamless scroll
   */
  private render(): void {
    // Remove agents past the activity window
    this.pruneInactiveAgents();

    if (this.recentAgents.length === 0) {
      console.log('AgentTicker: No recent agents');
      this.tickerContent.innerHTML = '';
      this.tickerContent.style.animation = 'none';
      this.animationStarted = false;
      // Show waiting state
      const waiting = document.createElement('span');
      waiting.style.cssText = `color: rgba(255, 160, 100, 0.5); font-size: 9px; letter-spacing: 1px; padding-left: 20px;`;
      waiting.textContent = 'Listening for agent activity...';
      this.tickerContent.appendChild(waiting);
      return;
    }

    console.log('AgentTicker: Rendering agents:', this.recentAgents.map(a => a.name));

    // Always rebuild to show newest order
    this.tickerContent.innerHTML = '';
    this.animationStarted = false;

    // Create items - duplicate for seamless scrolling
    const items = [...this.recentAgents, ...this.recentAgents];
    
    for (const agent of items) {
      const item = document.createElement('div');
      item.className = 'agent-ticker-item';

      const dot = document.createElement('span');
      dot.className = 'agent-ticker-dot';

      const name = document.createElement('span');
      name.className = 'agent-ticker-name';
      name.textContent = agent.name;

      item.appendChild(dot);
      item.appendChild(name);
      this.tickerContent.appendChild(item);
    }

    // Start animation
    const contentWidth = this.tickerContent.scrollWidth / 2; // Half because of duplicates
    if (contentWidth > 0) {
      const duration = Math.max(20, Math.min(60, contentWidth / 25));
      this.tickerContent.style.animation = `scroll-ticker-left ${duration}s linear infinite`;
      this.animationStarted = true;
      console.log('AgentTicker: Animation started, duration:', duration, 's, agents:', this.recentAgents.length);
    }
  }

  /**
   * Destroy the ticker and clean up
   */
  destroy(): void {
    this.stop();
    if (this.provider) {
      this.provider = null;
    }
    if (this.container.parentNode) {
      this.container.parentNode.removeChild(this.container);
    }
  }
}