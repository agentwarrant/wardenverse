/**
 * AgentTicker - Scrolling ticker showing active agents with proof of inferences
 * Displays agent names in a horizontal scrolling bar at the bottom of the screen
 * Polls the Warden proof-of-inference API for real-time activity
 */

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

interface ActivityItem {
  agentId: number;
  timestamp: string;
  [key: string]: unknown;
}

interface DashboardResponse {
  state: {
    activityItems: ActivityItem[];
    agentsInfo: Record<string, {
      agentId: number;
      cardData: {
        name: string;
        description?: string;
        iconUrl?: string;
      };
    }>;
    stats: {
      totalProofs: number;
      activeAgents: number;
      newProofs: number;
      totalAgentRuns: number;
    };
  };
}

interface ActiveAgent {
  id: string;
  name: string;
  lastActivity: number;
  proofCount: number;
}

export class AgentTicker {
  private container: HTMLDivElement;
  private tickerContent: HTMLDivElement;
  private pollingInterval: number = 8000; // Poll every 8 seconds
  private activityWindowMs: number = 180000; // Show agents active in last 3 minutes
  private activeAgents: Map<string, ActiveAgent> = new Map();
  private isRunning: boolean = false;
  private pollTimer: ReturnType<typeof setInterval> | null = null;

  constructor() {
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

    // Create header/label - position to the right of BurnOMeter (which is at left:20px, min-width:180px)
    const headerContainer = document.createElement('div');
    headerContainer.className = 'agent-ticker-header';
    headerContainer.style.cssText = `
      position: absolute;
      left: 200px;
      top: 0;
      bottom: 0;
      background: linear-gradient(90deg, rgba(10, 10, 20, 1) 0%, rgba(10, 10, 20, 0.95) 60%, transparent 100%);
      padding: 10px 15px;
      z-index: 10;
      display: flex;
      align-items: center;
      border-right: 1px solid rgba(255, 80, 60, 0.3);
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
      
      /* Fade mask on left side - before the header */
      #agent-ticker-container::before {
        content: '';
        position: absolute;
        left: 0;
        top: 0;
        bottom: 0;
        width: 200px;
        background: linear-gradient(90deg, rgba(10, 10, 20, 1) 0%, rgba(10, 10, 20, 0.9) 60%, transparent 100%);
        z-index: 5;
        pointer-events: none;
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
        
        #agent-ticker-container::before {
          width: 50px;
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
   * Start polling the API for agent activity
   */
  async start(): Promise<void> {
    if (this.isRunning) return;
    this.isRunning = true;

    // Initial fetch
    await this.fetchActivity();

    // Set up polling interval
    this.pollTimer = setInterval(() => {
      this.fetchActivity().catch(err => {
        console.error('AgentTicker: Poll error:', err);
      });
    }, this.pollingInterval);

    console.log('AgentTicker: Started polling for proof of inference activity');
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
   * Fetch activity from the proof-of-inference API
   */
  private async fetchActivity(): Promise<void> {
    try {
      // Always use proxy URL (Vite dev server proxy or Vercel rewrite)
      const apiUrl = '/api/proofs/v1/dashboard';
      
      console.log('AgentTicker: Fetching from', apiUrl);
      
      const response = await fetch(apiUrl, {
        headers: {
          'Accept': 'application/json',
        },
      });
      
      if (!response.ok) {
        throw new Error(`API returned ${response.status}`);
      }

      const data: DashboardResponse = await response.json();
      console.log('AgentTicker: Fetched data, activityItems:', data.state.activityItems.length);

      // Process activity items
      this.processActivity(data);
    } catch (error) {
      console.error('AgentTicker: Fetch error:', error);
      // Show error state
      this.showErrorState(error instanceof Error ? error.message : 'Connection failed');
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
    waiting.textContent = 'Connecting...';
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
   * Process activity items and update active agents
   */
  private processActivity(data: DashboardResponse): void {
    const now = Date.now();
    const cutoff = now - this.activityWindowMs;

    // Clear agents that have gone inactive
    for (const [id, agent] of this.activeAgents) {
      if (agent.lastActivity < cutoff) {
        this.activeAgents.delete(id);
      }
    }

    // Process recent activity items
    const recentItems = data.state.activityItems.filter(item => {
      const timestamp = new Date(item.timestamp).getTime();
      return timestamp >= cutoff;
    });

    console.log('AgentTicker: Recent items in window:', recentItems.length);

    // Count production agent activity
    let productionAgentCount = 0;
    
    for (const item of recentItems) {
      const agentId = String(item.agentId);
      
      // Only track production agents
      if (!PRODUCTION_AGENTS[agentId]) continue;
      
      productionAgentCount++;

      const timestamp = new Date(item.timestamp).getTime();
      const existing = this.activeAgents.get(agentId);
      
      if (existing) {
        existing.lastActivity = Math.max(existing.lastActivity, timestamp);
        existing.proofCount++;
      } else {
        this.activeAgents.set(agentId, {
          id: agentId,
          name: PRODUCTION_AGENTS[agentId],
          lastActivity: timestamp,
          proofCount: 1
        });
      }
    }

    console.log('AgentTicker: Production agent activity found:', productionAgentCount);
    console.log('AgentTicker: Active agents:', Array.from(this.activeAgents.values()).map(a => a.name));

    // Update the display
    this.render();
  }

  /**
   * Render the ticker content
   */
  private render(): void {
    // Clear current content
    this.tickerContent.innerHTML = '';

    if (this.activeAgents.size === 0) {
      // No active agents - show empty but with header visible
      console.log('AgentTicker: No active agents in window, ticker empty');
      this.tickerContent.style.animation = 'none';
      // Don't add any content - just show the header
      return;
    }

    // Sort agents by most recent activity
    const sortedAgents = Array.from(this.activeAgents.values())
      .sort((a, b) => b.lastActivity - a.lastActivity);

    console.log('AgentTicker: Rendering agents:', sortedAgents.map(a => a.name));

    // Create items for each active agent (duplicate for seamless scrolling)
    const items = [...sortedAgents, ...sortedAgents]; // Duplicate for infinite scroll effect

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

    // Enable scrolling animation - scroll left to right (items move left)
    this.tickerContent.style.animation = 'scroll-ticker-left 30s linear infinite';

    // Adjust animation speed based on content width
    const contentWidth = this.tickerContent.scrollWidth / 2;
    if (contentWidth > 0) {
      const duration = Math.max(15, Math.min(60, contentWidth / 30));
      this.tickerContent.style.animationDuration = `${duration}s`;
    }
  }

  /**
   * Destroy the ticker and clean up
   */
  destroy(): void {
    this.stop();
    if (this.container.parentNode) {
      this.container.parentNode.removeChild(this.container);
    }
  }
}