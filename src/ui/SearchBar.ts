/**
 * SearchBar - Search for transactions, addresses, and blocks
 * Pixel-art styled search input with results dropdown
 */

import { InfoPopup } from './InfoPopup';

export interface SearchResult {
  type: 'transaction' | 'block' | 'address';
  hash?: string;
  number?: number;
  address?: string;
  data?: unknown;
}

export type SearchLookupFn = (query: string) => Promise<SearchResult | null>;

export class SearchBar {
  private container: HTMLDivElement;
  private input: HTMLInputElement;
  private resultsContainer: HTMLDivElement;
  private searchIcon: HTMLDivElement;
  private clearButton: HTMLButtonElement;
  private loadingIndicator: HTMLDivElement;
  private infoPopup: InfoPopup;
  private lookupFn: SearchLookupFn | null = null;
  private explorerBaseUrl: string = 'https://explorer.wardenprotocol.org';
  private debounceTimer: NodeJS.Timeout | null = null;
  private isSearching: boolean = false;

  constructor(infoPopup: InfoPopup) {
    this.infoPopup = infoPopup;
    
    // Create main container
    this.container = document.createElement('div');
    this.container.id = 'search-container';
    this.container.style.cssText = `
      position: relative;
      display: flex;
      align-items: center;
      margin-left: 20px;
    `;

    // Create search icon
    this.searchIcon = document.createElement('div');
    this.searchIcon.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style="image-rendering: pixelated;">
        <circle cx="6" cy="6" r="4" stroke="#fbbf24" stroke-width="2" fill="none"/>
        <line x1="9" y1="9" x2="14" y2="14" stroke="#fbbf24" stroke-width="2"/>
      </svg>
    `;
    this.searchIcon.style.cssText = `
      position: absolute;
      left: 10px;
      top: 50%;
      transform: translateY(-50%);
      pointer-events: none;
      opacity: 0.7;
    `;

    // Create input field
    this.input = document.createElement('input');
    this.input.type = 'text';
    this.input.placeholder = 'Search tx, address, block...';
    this.input.style.cssText = `
      background: rgba(20, 20, 35, 0.9);
      border: 2px solid rgba(251, 191, 36, 0.3);
      border-radius: 8px;
      color: #e0e0e0;
      font-size: 12px;
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
      padding: 8px 32px 8px 32px;
      width: 220px;
      transition: all 0.2s ease;
      outline: none;
    `;

    // Hover/focus styles
    this.input.addEventListener('focus', () => {
      this.input.style.borderColor = 'rgba(251, 191, 36, 0.6)';
      this.input.style.background = 'rgba(30, 30, 50, 0.95)';
      this.input.style.boxShadow = '0 0 20px rgba(251, 191, 36, 0.2)';
    });

    this.input.addEventListener('blur', () => {
      this.input.style.borderColor = 'rgba(251, 191, 36, 0.3)';
      this.input.style.background = 'rgba(20, 20, 35, 0.9)';
      this.input.style.boxShadow = 'none';
    });

    // Create clear button
    this.clearButton = document.createElement('button');
    this.clearButton.innerHTML = '×';
    this.clearButton.style.cssText = `
      position: absolute;
      right: 8px;
      top: 50%;
      transform: translateY(-50%);
      background: none;
      border: none;
      color: #888;
      font-size: 16px;
      cursor: pointer;
      padding: 2px 6px;
      line-height: 1;
      display: none;
      transition: color 0.2s;
    `;
    this.clearButton.addEventListener('mouseenter', () => {
      this.clearButton.style.color = '#fbbf24';
    });
    this.clearButton.addEventListener('mouseleave', () => {
      this.clearButton.style.color = '#888';
    });
    this.clearButton.addEventListener('click', () => {
      this.clear();
    });

    // Create loading indicator
    this.loadingIndicator = document.createElement('div');
    this.loadingIndicator.style.cssText = `
      position: absolute;
      right: 28px;
      top: 50%;
      transform: translateY(-50%);
      width: 14px;
      height: 14px;
      border: 2px solid rgba(251, 191, 36, 0.3);
      border-top-color: #fbbf24;
      border-radius: 50%;
      animation: search-spin 0.8s linear infinite;
      display: none;
    `;

    // Add loading animation
    const styleSheet = document.createElement('style');
    styleSheet.textContent = `
      @keyframes search-spin {
        to { transform: translateY(-50%) rotate(360deg); }
      }
      #search-container input::placeholder {
        color: #666;
      }
      #search-container input:focus::placeholder {
        color: #888;
      }
      .search-results {
        position: absolute;
        top: 100%;
        left: 0;
        right: 0;
        margin-top: 4px;
        background: rgba(20, 20, 35, 0.98);
        border: 2px solid rgba(251, 191, 36, 0.3);
        border-radius: 8px;
        max-height: 300px;
        overflow-y: auto;
        z-index: 1000;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
      }
      .search-result-item {
        padding: 12px 14px;
        cursor: pointer;
        border-bottom: 1px solid rgba(100, 100, 150, 0.2);
        transition: background 0.15s;
      }
      .search-result-item:last-child {
        border-bottom: none;
      }
      .search-result-item:hover {
        background: rgba(251, 191, 36, 0.1);
      }
      .search-result-type {
        font-size: 9px;
        text-transform: uppercase;
        letter-spacing: 1px;
        margin-bottom: 4px;
        font-family: 'Press Start 2P', monospace;
      }
      .search-result-type.tx { color: #a78bfa; }
      .search-result-type.block { color: #fbbf24; }
      .search-result-type.address { color: #60a5fa; }
      .search-result-value {
        font-family: 'JetBrains Mono', 'Fira Code', monospace;
        font-size: 11px;
        color: #e0e0e0;
        word-break: break-all;
      }
      .search-result-meta {
        font-size: 10px;
        color: #888;
        margin-top: 4px;
      }
      .search-no-results {
        padding: 16px;
        text-align: center;
        color: #888;
        font-size: 12px;
      }
      .search-error {
        padding: 16px;
        text-align: center;
        color: #ef4444;
        font-size: 12px;
      }
      @media (max-width: 768px) {
        #search-container {
          margin-left: 10px;
          order: 10;
          width: 100%;
          margin-top: 8px;
        }
        #search-container input {
          width: 100%;
          font-size: 11px;
          padding: 6px 28px 6px 28px;
        }
        .search-results {
          position: fixed;
          left: 10px;
          right: 10px;
          top: auto;
          margin-top: 2px;
        }
      }
    `;
    document.head.appendChild(styleSheet);

    // Create results container
    this.resultsContainer = document.createElement('div');
    this.resultsContainer.className = 'search-results';
    this.resultsContainer.style.display = 'none';

    // Assemble
    this.container.appendChild(this.searchIcon);
    this.container.appendChild(this.input);
    this.container.appendChild(this.clearButton);
    this.container.appendChild(this.loadingIndicator);
    this.container.appendChild(this.resultsContainer);

    // Event listeners
    this.input.addEventListener('input', () => {
      this.handleInput();
    });

    this.input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        this.handleSearch();
      } else if (e.key === 'Escape') {
        this.hideResults();
        this.input.blur();
      }
    });

    // Hide results on click outside
    document.addEventListener('click', (e) => {
      if (!this.container.contains(e.target as Node)) {
        this.hideResults();
      }
    });
  }

  /**
   * Set the lookup function for performing searches
   */
  setLookupFn(fn: SearchLookupFn): void {
    this.lookupFn = fn;
  }

  /**
   * Set the explorer base URL
   */
  setExplorerUrl(url: string): void {
    this.explorerBaseUrl = url;
  }

  /**
   * Get the container element
   */
  getElement(): HTMLDivElement {
    return this.container;
  }

  /**
   * Handle input changes with debounce
   */
  private handleInput(): void {
    const value = this.input.value.trim();
    
    // Show/hide clear button
    this.clearButton.style.display = value.length > 0 ? 'block' : 'none';
    
    if (value.length === 0) {
      this.hideResults();
      return;
    }

    // Debounce search
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }
    
    this.debounceTimer = setTimeout(() => {
      this.handleSearch();
    }, 300);
  }

  /**
   * Perform the search
   */
  private async handleSearch(): Promise<void> {
    const query = this.input.value.trim();
    
    if (!query || !this.lookupFn) {
      return;
    }

    // Validate query format
    const queryType = this.detectQueryType(query);
    
    // Show loading
    this.setLoading(true);
    this.isSearching = true;

    try {
      // For addresses, show a direct link option immediately
      if (queryType === 'address') {
        this.showAddressResult(query);
        this.setLoading(false);
        return;
      }

      // For blocks by number, show direct link
      if (queryType === 'blockNumber') {
        const blockNum = parseInt(query, 10);
        this.showBlockNumberResult(blockNum);
        this.setLoading(false);
        return;
      }

      // For tx hashes or block hashes, look up via RPC
      const result = await this.lookupFn(query);
      
      if (result) {
        this.showResult(result);
      } else {
        this.showNoResults(query);
      }
    } catch (error) {
      console.error('Search error:', error);
      this.showError('Failed to search. Please try again.');
    } finally {
      this.setLoading(false);
      this.isSearching = false;
    }
  }

  /**
   * Detect the type of query
   */
  private detectQueryType(query: string): 'txHash' | 'blockHash' | 'blockNumber' | 'address' | 'unknown' {
    // Transaction hash (64 hex chars, starts with 0x)
    if (/^0x[a-fA-F0-9]{64}$/.test(query)) {
      return 'txHash'; // Could also be a block hash
    }
    
    // Block number (pure numeric)
    if (/^\d+$/.test(query)) {
      return 'blockNumber';
    }
    
    // Address (40 hex chars, starts with 0x)
    if (/^0x[a-fA-F0-9]{40}$/.test(query)) {
      return 'address';
    }
    
    return 'unknown';
  }

  /**
   * Show address result with direct explorer link
   */
  private showAddressResult(address: string): void {
    this.resultsContainer.innerHTML = `
      <div class="search-result-item" data-type="address" data-address="${address}">
        <div class="search-result-type address">Address</div>
        <div class="search-result-value">${address}</div>
        <div class="search-result-meta">Click to view on explorer</div>
      </div>
    `;
    
    this.resultsContainer.style.display = 'block';
    
    // Add click handler
    const item = this.resultsContainer.querySelector('.search-result-item');
    if (item) {
      item.addEventListener('click', () => {
        window.open(`${this.explorerBaseUrl}/address/${address}`, '_blank');
        this.hideResults();
      });
    }
  }

  /**
   * Show block number result with direct explorer link
   */
  private showBlockNumberResult(blockNum: number): void {
    this.resultsContainer.innerHTML = `
      <div class="search-result-item" data-type="block" data-number="${blockNum}">
        <div class="search-result-type block">Block</div>
        <div class="search-result-value">#${blockNum.toLocaleString()}</div>
        <div class="search-result-meta">Click to view on explorer</div>
      </div>
    `;
    
    this.resultsContainer.style.display = 'block';
    
    // Add click handler
    const item = this.resultsContainer.querySelector('.search-result-item');
    if (item) {
      item.addEventListener('click', () => {
        window.open(`${this.explorerBaseUrl}/block/${blockNum}`, '_blank');
        this.hideResults();
      });
    }
  }

  /**
   * Show search result in results dropdown
   */
  private showResult(result: SearchResult): void {
    const formatHash = (hash: string): string => {
      if (hash.length <= 24) return hash;
      return `${hash.slice(0, 12)}…${hash.slice(-10)}`;
    };

    let html = '';
    
    if (result.type === 'transaction') {
      const data = result.data as { hash: string; blockNumber: number; from: string; to: string | null; value: string; type: string };
      const typeColors: { [key: string]: string } = {
        transfer: '#60a5fa',
        token: '#34d399',
        contract: '#f472b6',
        inference: '#ff503c'
      };
      const typeLabels: { [key: string]: string } = {
        transfer: 'Transfer',
        token: 'Token Transfer',
        contract: 'Contract Call',
        inference: 'Proof of Inference'
      };
      const color = typeColors[data.type] || '#60a5fa';
      const label = typeLabels[data.type] || 'Transaction';
      
      html = `
        <div class="search-result-item" data-type="tx" data-hash="${data.hash}">
          <div class="search-result-type tx" style="color: ${color}">${label}</div>
          <div class="search-result-value">${formatHash(data.hash)}</div>
          <div class="search-result-meta">Block #${data.blockNumber.toLocaleString()} • From ${formatHash(data.from)}${data.to ? ` → ${formatHash(data.to)}` : ''}</div>
        </div>
      `;
    } else if (result.type === 'block') {
      const data = result.data as { number: number; hash: string; txCount: number; timestamp: number };
      const time = new Date(data.timestamp * 1000).toLocaleString();
      
      html = `
        <div class="search-result-item" data-type="block" data-number="${data.number}">
          <div class="search-result-type block">Block</div>
          <div class="search-result-value">#${data.number.toLocaleString()}</div>
          <div class="search-result-meta">${data.txCount} transactions • ${time}</div>
        </div>
      `;
    }

    this.resultsContainer.innerHTML = html;
    this.resultsContainer.style.display = 'block';

    // Add click handler
    const item = this.resultsContainer.querySelector('.search-result-item');
    if (item) {
      item.addEventListener('click', () => {
        this.selectResult(result);
      });
    }
  }

  /**
   * Handle result selection - show popup or open explorer
   */
  private selectResult(result: SearchResult): void {
    this.hideResults();
    
    if (result.type === 'transaction' && result.hash) {
      const data = result.data as { hash: string; blockNumber: number; from: string; to: string | null; value: string; gasPrice: string; type: 'transfer' | 'contract' | 'token' | 'inference' };
      this.infoPopup.showTransaction({
        hash: data.hash,
        blockNumber: data.blockNumber,
        from: data.from,
        to: data.to,
        value: data.value,
        gasPrice: data.gasPrice,
        type: data.type
      });
    } else if (result.type === 'block' && result.number !== undefined) {
      const data = result.data as { number: number; hash: string; timestamp: number; transactions: string[]; gasUsed: string; gasLimit: string; parentHash: string };
      this.infoPopup.showBlock({
        number: data.number,
        hash: data.hash,
        timestamp: data.timestamp,
        transactions: data.transactions,
        gasUsed: data.gasUsed,
        gasLimit: data.gasLimit,
        parentHash: data.parentHash || ''
      });
    }
  }

  /**
   * Show no results message
   */
  private showNoResults(query: string): void {
    const shortQuery = query.length > 20 ? `${query.slice(0, 20)}...` : query;
    this.resultsContainer.innerHTML = `
      <div class="search-no-results">
        No results found for "${shortQuery}"
      </div>
    `;
    this.resultsContainer.style.display = 'block';
  }

  /**
   * Show error message
   */
  private showError(message: string): void {
    this.resultsContainer.innerHTML = `
      <div class="search-error">${message}</div>
    `;
    this.resultsContainer.style.display = 'block';
  }

  /**
   * Hide results dropdown
   */
  private hideResults(): void {
    this.resultsContainer.style.display = 'none';
  }

  /**
   * Set loading state
   */
  private setLoading(loading: boolean): void {
    this.loadingIndicator.style.display = loading ? 'block' : 'none';
    this.clearButton.style.display = loading ? 'none' : (this.input.value.trim().length > 0 ? 'block' : 'none');
    this.input.disabled = loading;
  }

  /**
   * Clear the search input
   */
  clear(): void {
    this.input.value = '';
    this.clearButton.style.display = 'none';
    this.hideResults();
  }

  /**
   * Focus the search input
   */
  focus(): void {
    this.input.focus();
  }

  /**
   * Destroy the search bar
   */
  destroy(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }
    this.container.remove();
  }
}