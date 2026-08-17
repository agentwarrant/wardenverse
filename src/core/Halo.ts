/**
 * Halo vault configuration
 *
 * Halo is a peer-to-peer inference marketplace on Base. The vault escrows the
 * USDC that pays for inference: a consumer deposits credit, an operator
 * (inference provider) reserves against that credit for a session, and
 * redeems payment for the inferences it served. Unspent reservations expire
 * and are released back to the consumer.
 *
 * Every state-changing interaction with the vault emits an event, so we watch
 * the contract's logs on Base rather than polling Base blocks — Base produces
 * ~2s blocks with far too much unrelated traffic to visualize.
 *
 * Vault: https://basescan.org/address/0x3907f660b257560883e891fbbb9f997eff70e40e
 */

export const HALO_VAULT_ADDRESS = '0x3907f660b257560883e891fbbb9f997eff70e40e';

export const HALO_CHAIN_ID = 8453; // Base mainnet
export const HALO_EXPLORER_URL = 'https://basescan.org';

/** The vault is denominated in USDC (6 decimals). */
export const HALO_USDC_DECIMALS = 6;

/**
 * Public Base RPC endpoints, tried in order. The data source rotates to the
 * next one if a poll fails repeatedly (public endpoints are rate limited).
 * Override with VITE_BASE_RPC_URL to use a dedicated endpoint.
 */
export const HALO_RPC_URLS: string[] = (() => {
  const override = (import.meta as { env?: Record<string, string | undefined> }).env?.VITE_BASE_RPC_URL;
  const defaults = [
    'https://mainnet.base.org',
    'https://base-rpc.publicnode.com',
    'https://base.llamarpc.com',
  ];
  return override ? [override, ...defaults] : defaults;
})();

/** Halo brand colors (cyan/blue) - kept distinct from Warden's gold. */
export const HALO_COLORS = {
  cyan: [0, 180, 230] as [number, number, number],
  blue: [28, 100, 242] as [number, number, number],
  ice: [91, 176, 238] as [number, number, number],
  hex: '#00b4e6',
  glow: 'rgba(0, 180, 230, 0.6)',
};

/** Event ABI for the vault - human-readable fragments for ethers Interface. */
export const HALO_VAULT_ABI = [
  'event Deposited(address indexed consumer, uint256 amount, address sessionKey)',
  'event Withdrawn(address indexed consumer, address indexed to, uint256 amount)',
  'event WithdrawRequested(address indexed consumer, uint64 at, uint256 authorized)',
  'event WithdrawRequestCancelled(address indexed consumer)',
  'event Reserved(address indexed consumer, address indexed operator, uint256 amount, uint64 expiry, uint64 cycle)',
  'event Redeemed(address indexed consumer, address indexed operator, uint256 paid, uint256 fee, uint256 cumulative)',
  'event ReleasedExpired(address indexed consumer, address indexed operator, uint256 amount)',
  'event SessionKeySet(address indexed consumer, address sessionKey, uint256 keyEpoch)',
  'event ReservesFrozenSet(address indexed consumer, bool frozen)',
  'event FeesCollected(address indexed recipient, uint256 amount)',
  'event FeeSet(uint16 feeBps)',
  'event FeeProposed(uint16 feeBps, uint64 effectiveAt)',
  'event FeeChangeCancelled()',
  'event FeeRecipientSet(address recipient)',
  'event FeeRecipientProposed(address recipient, uint64 effectiveAt)',
  'event FeeRecipientChangeCancelled()',
  'event FeeAdminTransferStarted(address indexed pendingFeeAdmin)',
  'event FeeAdminTransferred(address indexed newFeeAdmin)',
  'event PausedSet(uint64 pausedUntil)',
  'event EIP712DomainChanged()',
];

export interface HaloEventDescriptor {
  /** Human-readable label shown in the UI. */
  label: string;
  /** Argument holding the USDC amount, if the event carries one. */
  amountArg?: string;
  /** Argument holding the counterparty address, if any. */
  counterpartyArg?: string;
  /** Relative visual weight - drives comet size when no amount is present. */
  weight: number;
}

/**
 * How each vault event is presented. Events not listed here still show up as
 * generic "Vault Activity" so nothing on the contract is silently dropped.
 */
export const HALO_EVENTS: Record<string, HaloEventDescriptor> = {
  Deposited: { label: 'Inference Credit Funded', amountArg: 'amount', weight: 1.4 },
  Withdrawn: { label: 'Credit Withdrawn', amountArg: 'amount', counterpartyArg: 'to', weight: 1.4 },
  WithdrawRequested: { label: 'Withdraw Requested', amountArg: 'authorized', weight: 1 },
  WithdrawRequestCancelled: { label: 'Withdraw Cancelled', weight: 0.8 },
  Reserved: { label: 'Inference Reserved', amountArg: 'amount', counterpartyArg: 'operator', weight: 1.2 },
  Redeemed: { label: 'Inference Paid', amountArg: 'paid', counterpartyArg: 'operator', weight: 1.6 },
  ReleasedExpired: { label: 'Reserve Released', amountArg: 'amount', counterpartyArg: 'operator', weight: 1 },
  SessionKeySet: { label: 'Session Key Set', counterpartyArg: 'sessionKey', weight: 0.8 },
  ReservesFrozenSet: { label: 'Reserves Frozen', weight: 1 },
  FeesCollected: { label: 'Fees Collected', amountArg: 'amount', weight: 1.2 },
  FeeSet: { label: 'Fee Updated', weight: 0.8 },
  FeeProposed: { label: 'Fee Proposed', weight: 0.8 },
  FeeChangeCancelled: { label: 'Fee Change Cancelled', weight: 0.8 },
  FeeRecipientSet: { label: 'Fee Recipient Set', weight: 0.8 },
  FeeRecipientProposed: { label: 'Fee Recipient Proposed', weight: 0.8 },
  FeeRecipientChangeCancelled: { label: 'Fee Recipient Cancelled', weight: 0.8 },
  FeeAdminTransferStarted: { label: 'Fee Admin Pending', weight: 0.8 },
  FeeAdminTransferred: { label: 'Fee Admin Changed', weight: 0.8 },
  PausedSet: { label: 'Vault Paused', weight: 1.6 },
  EIP712DomainChanged: { label: 'Domain Changed', weight: 0.8 },
};

export const HALO_FALLBACK_EVENT: HaloEventDescriptor = {
  label: 'Vault Activity',
  weight: 1,
};

/**
 * Halo-specific detail attached to a Transaction with type 'halo'.
 * Defined here (rather than in the data source) so the transaction type can
 * reference it without importing the Halo data source.
 */
export interface HaloMeta {
  /** Raw contract event name, e.g. "Redeemed". */
  event: string;
  /** Human-readable label, e.g. "Trade Settled". */
  label: string;
  /** The vault user this event belongs to. */
  consumer: string;
  /** Operator / recipient / session key, depending on the event. */
  counterparty: string | null;
  /** USDC amount in base units, if the event carries one. */
  amountRaw: string | null;
  /** USDC amount formatted for display, if the event carries one. */
  amountUsdc: string | null;
  /** Relative visual weight for the comet. */
  weight: number;
  /** Log index within the Base transaction. */
  logIndex: number;
}

/** Format a raw USDC amount (6 decimals) for display, e.g. "12.34". */
export function formatUsdc(raw: bigint): string {
  const negative = raw < 0n;
  const abs = negative ? -raw : raw;
  const unit = 10n ** BigInt(HALO_USDC_DECIMALS);
  const whole = abs / unit;
  const fraction = abs % unit;

  let decimals: string;
  if (whole >= 1000n) {
    decimals = ''; // Large amounts read better without cents
  } else if (whole >= 1n) {
    decimals = '.' + fraction.toString().padStart(HALO_USDC_DECIMALS, '0').slice(0, 2);
  } else {
    // Sub-dollar amounts keep more precision so micro-trades don't read as 0
    decimals = '.' + fraction.toString().padStart(HALO_USDC_DECIMALS, '0').slice(0, 4).replace(/0+$/, '');
    if (decimals === '.') decimals = '.0';
  }

  return `${negative ? '-' : ''}${whole.toLocaleString('en-US')}${decimals}`;
}
