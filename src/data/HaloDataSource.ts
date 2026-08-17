/**
 * Halo Data Source - watches the Halo inference-marketplace vault on Base
 *
 * Polls the vault contract's logs (every state-changing interaction with the
 * vault emits an event) and turns each one into a 'halo' transaction that flows
 * through the same pipeline as Warden transactions: comet, tx scroll, sound.
 *
 * This runs alongside the Warden chain feed rather than replacing it - Halo
 * activity is an overlay on the Wardenverse, not a separate chain view.
 */

import { JsonRpcProvider, Interface, Log } from 'ethers';
import {
  HALO_VAULT_ADDRESS,
  HALO_VAULT_ABI,
  HALO_RPC_URLS,
  HALO_EVENTS,
  HALO_FALLBACK_EVENT,
  HaloMeta,
  formatUsdc,
} from '../core/Halo';
import type { Transaction } from './BlockchainDataSource';

type HaloTransactionCallback = (tx: Transaction) => void;
type HaloStatsCallback = (stats: HaloStats) => void;

export interface HaloStats {
  /** Vault events seen since page load. */
  events: number;
  /** USDC (base units) settled to operators for inference since page load. */
  volumeRaw: bigint;
  /** Settled USDC formatted for display. */
  volumeUsdc: string;
}

/** How often to poll for new vault logs. Base blocks are ~2s. */
const POLL_INTERVAL_MS = 8000;

/** Never scan more than this many blocks in one poll (RPC range limits). */
const MAX_BLOCK_RANGE = 400;

/** Events are released one at a time so a busy block doesn't dump 30 comets at once. */
const RELEASE_INTERVAL_MS = 400;

/** Cap the pending queue so a backlog can't grow without bound. */
const MAX_QUEUE_LENGTH = 40;

/** Rotate to the next RPC endpoint after this many consecutive failures. */
const FAILURES_BEFORE_ROTATE = 3;

export class HaloDataSource {
  private provider: JsonRpcProvider | null = null;
  private iface = new Interface(HALO_VAULT_ABI);
  private rpcIndex: number = 0;
  private consecutiveFailures: number = 0;
  private lastBlockNumber: number = 0;
  private running: boolean = false;
  private wasHidden: boolean = false;
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private releaseTimer: ReturnType<typeof setInterval> | null = null;
  private visibilityHandler: (() => void) | null = null;
  private queue: Transaction[] = [];
  private txCallbacks: HaloTransactionCallback[] = [];
  private statsCallbacks: HaloStatsCallback[] = [];
  private stats: HaloStats = { events: 0, volumeRaw: 0n, volumeUsdc: '0' };

  onTransaction(callback: HaloTransactionCallback): void {
    this.txCallbacks.push(callback);
  }

  onStats(callback: HaloStatsCallback): void {
    this.statsCallbacks.push(callback);
  }

  getStats(): HaloStats {
    return { ...this.stats };
  }

  isConnected(): boolean {
    return this.provider !== null;
  }

  async start(): Promise<boolean> {
    if (this.running) return true;
    this.running = true;

    const connected = await this.connectProvider();
    if (!connected) {
      console.error('HaloDataSource: could not connect to any Base RPC endpoint');
      this.running = false;
      return false;
    }

    // While the tab is hidden we stop draining the queue; on return we skip
    // whatever piled up instead of firing a burst of stale comets.
    this.visibilityHandler = () => {
      if (document.visibilityState === 'hidden') {
        this.wasHidden = true;
        this.queue = [];
      }
    };
    document.addEventListener('visibilitychange', this.visibilityHandler);

    this.pollTimer = setInterval(() => {
      this.poll().catch(err => console.error('HaloDataSource: poll failed:', err));
    }, POLL_INTERVAL_MS);

    this.releaseTimer = setInterval(() => this.releaseNext(), RELEASE_INTERVAL_MS);

    console.log(`HaloDataSource: watching Halo vault ${HALO_VAULT_ADDRESS} from Base block ${this.lastBlockNumber}`);
    return true;
  }

  stop(): void {
    this.running = false;
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
    if (this.releaseTimer) {
      clearInterval(this.releaseTimer);
      this.releaseTimer = null;
    }
    if (this.visibilityHandler) {
      document.removeEventListener('visibilitychange', this.visibilityHandler);
      this.visibilityHandler = null;
    }
    this.queue = [];
    this.provider = null;
  }

  /** Connect to the current RPC endpoint, falling back through the list. */
  private async connectProvider(): Promise<boolean> {
    for (let attempt = 0; attempt < HALO_RPC_URLS.length; attempt++) {
      const url = HALO_RPC_URLS[this.rpcIndex];
      try {
        const provider = new JsonRpcProvider(url);
        const blockNumber = await provider.getBlockNumber();
        this.provider = provider;
        this.consecutiveFailures = 0;
        // Start from the current head - history is not replayed on load
        if (this.lastBlockNumber === 0) {
          this.lastBlockNumber = blockNumber;
        }
        console.log(`HaloDataSource: connected to Base via ${url} (block ${blockNumber})`);
        return true;
      } catch (error) {
        console.warn(`HaloDataSource: ${url} unavailable:`, error);
        this.rpcIndex = (this.rpcIndex + 1) % HALO_RPC_URLS.length;
      }
    }
    this.provider = null;
    return false;
  }

  private async rotateProvider(): Promise<void> {
    this.rpcIndex = (this.rpcIndex + 1) % HALO_RPC_URLS.length;
    this.consecutiveFailures = 0;
    this.provider = null;
    await this.connectProvider();
  }

  private async poll(): Promise<void> {
    if (!this.running || !this.provider) return;

    // No point fetching logs we're going to throw away
    if (document.visibilityState !== 'visible') return;

    try {
      const currentBlock = await this.provider.getBlockNumber();
      if (currentBlock <= this.lastBlockNumber) return;

      // After a hidden tab (or a long stall) skip ahead instead of replaying
      if (this.wasHidden) {
        this.wasHidden = false;
        this.lastBlockNumber = Math.max(this.lastBlockNumber, currentBlock - 1);
      }

      const fromBlock = Math.max(this.lastBlockNumber + 1, currentBlock - MAX_BLOCK_RANGE + 1);
      const logs = await this.provider.getLogs({
        address: HALO_VAULT_ADDRESS,
        fromBlock,
        toBlock: currentBlock,
      });

      this.lastBlockNumber = currentBlock;
      this.consecutiveFailures = 0;

      for (const log of logs) {
        const tx = this.decodeLog(log);
        if (tx) this.enqueue(tx);
      }
    } catch (error) {
      this.consecutiveFailures++;
      console.warn(`HaloDataSource: poll error (${this.consecutiveFailures}):`, error);
      if (this.consecutiveFailures >= FAILURES_BEFORE_ROTATE) {
        await this.rotateProvider();
      }
    }
  }

  /** Turn a vault log into a 'halo' transaction. */
  private decodeLog(log: Log): Transaction | null {
    let event = 'Unknown';
    let consumer = HALO_VAULT_ADDRESS;
    let counterparty: string | null = null;
    let amountRaw: bigint | null = null;

    try {
      const parsed = this.iface.parseLog({ topics: [...log.topics], data: log.data });
      if (parsed) {
        event = parsed.name;
        const descriptor = HALO_EVENTS[parsed.name] || HALO_FALLBACK_EVENT;

        // Every user-facing event names its subject 'consumer'; admin events don't.
        consumer = this.readAddress(parsed.args, 'consumer')
          ?? this.readAddress(parsed.args, 'recipient')
          ?? HALO_VAULT_ADDRESS;

        if (descriptor.counterpartyArg) {
          counterparty = this.readAddress(parsed.args, descriptor.counterpartyArg);
        }

        if (descriptor.amountArg) {
          const value = this.readValue(parsed.args, descriptor.amountArg);
          if (typeof value === 'bigint') amountRaw = value;
        }
      }
    } catch (error) {
      // Unknown topic (contract upgraded, or an event we don't model) - still
      // show it rather than dropping a real vault interaction.
      console.debug('HaloDataSource: unrecognized vault event:', error);
    }

    const descriptor = HALO_EVENTS[event] || HALO_FALLBACK_EVENT;

    const halo: HaloMeta = {
      event,
      label: descriptor.label,
      consumer,
      counterparty,
      amountRaw: amountRaw !== null ? amountRaw.toString() : null,
      amountUsdc: amountRaw !== null ? formatUsdc(amountRaw) : null,
      weight: descriptor.weight,
      logIndex: log.index,
    };

    // Only settled payments count as volume. Reservations and their releases
    // move the same USDC twice, so counting them would inflate the total.
    if (event === 'Redeemed' && amountRaw !== null && amountRaw > 0n) {
      this.stats.volumeRaw += amountRaw;
    }
    this.stats.events++;
    this.stats.volumeUsdc = formatUsdc(this.stats.volumeRaw);

    return {
      hash: log.transactionHash,
      blockNumber: log.blockNumber,
      from: consumer,
      to: HALO_VAULT_ADDRESS,
      value: amountRaw !== null ? amountRaw.toString() : '0',
      gasPrice: '0',
      type: 'halo',
      halo,
    };
  }

  private readAddress(args: unknown, name: string): string | null {
    const value = this.readValue(args, name);
    return typeof value === 'string' ? value : null;
  }

  private readValue(args: unknown, name: string): unknown {
    if (!args || typeof args !== 'object') return undefined;
    return (args as Record<string, unknown>)[name];
  }

  private enqueue(tx: Transaction): void {
    if (this.queue.length >= MAX_QUEUE_LENGTH) {
      this.queue.shift(); // Drop the oldest - newer activity is more interesting
    }
    this.queue.push(tx);
    this.emitStats();
  }

  /** Release one queued event per tick so comets arrive spaced out. */
  private releaseNext(): void {
    if (!this.running || this.queue.length === 0) return;
    if (document.visibilityState !== 'visible') return;

    const tx = this.queue.shift();
    if (!tx) return;

    for (const callback of this.txCallbacks) {
      callback(tx);
    }
  }

  private emitStats(): void {
    const snapshot = this.getStats();
    for (const callback of this.statsCallbacks) {
      callback(snapshot);
    }
  }
}
