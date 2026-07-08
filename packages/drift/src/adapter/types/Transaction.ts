import type { Address, Bytes, Hash, HexString } from "src/adapter/types/Abi";
import type { Log } from "src/adapter/types/Event";

/** Legacy + EIP-1559 compatible transaction */
// https://github.com/ethereum/execution-apis/blob/e8727564bb74a1ebcd22a933b7b57eb7b71a11c3/src/schemas/transaction.yaml#L78
// https://github.com/ethereum/execution-apis/blob/e8727564bb74a1ebcd22a933b7b57eb7b71a11c3/src/schemas/transaction.yaml#L184
interface BaseTransactionProps {
  type: string;
  nonce: bigint;
  gas: bigint;
  value: bigint;
  input: Bytes;
  gasPrice?: bigint;
  chainId?: number;
  to?: Address;
}

// https://github.com/ethereum/execution-apis/blob/e3d2745289bd2bb61dc8593069871be4be441952/src/schemas/transaction.yaml#L329
export interface TransactionInfo {
  blockHash?: Hash;
  blockNumber?: bigint;
  from?: Address;
  transactionHash?: Hash;
  transactionIndex?: number;
}

export interface Transaction extends BaseTransactionProps, TransactionInfo {}

export interface MinedTransaction
  extends BaseTransactionProps,
    Required<TransactionInfo> {}

// https://github.com/ethereum/execution-apis/blob/e3d2745289bd2bb61dc8593069871be4be441952/src/schemas/receipt.yaml#L37
export interface TransactionReceipt extends Required<TransactionInfo> {
  /**
   * The sum of gas used by this transaction and all preceding transactions in
   * the same block.
   */
  cumulativeGasUsed: bigint;
  /**
   * The amount of gas used for this specific transaction alone.
   */
  gasUsed: bigint;
  /**
   * The logs emitted by this transaction, e.g. events emitted by the called
   * contract and any contracts it interacted with.
   */
  logs: Log[];
  logsBloom: Bytes;
  status: "success" | "reverted";
  /**
   * The actual value per gas deducted from the sender's account. Before
   * EIP-1559, this is equal to the transaction's gas price. After, it is equal
   * to baseFeePerGas + min(maxFeePerGas - baseFeePerGas, maxPriorityFeePerGas).
   */
  effectiveGasPrice: bigint;
  /**
   * Address of the receiver or `undefined` in a contract creation transaction.
   */
  to?: Address;
  /**
   * The contract address created, if the transaction was a contract creation,
   * otherwise undefined.
   */
  contractAddress?: Address;
}

export interface WalletCallsReceipt {
  // TODO:
  // logs: Log[]
  status: TransactionReceipt["status"];
  /**
   * Hash of the block containing the calls.
   */
  blockHash: Hash;
  /**
   * Block number containing the calls
   */
  blockNumber: bigint;
  /**
   * The amount of gas used by the calls.
   */
  gasUsed: bigint;
  /**
   * Hash of the transaction containing the calls.
   */
  transactionHash: Hash;
}

/**
 * Options for constructing a transaction.
 */
// https://github.com/ethereum/execution-apis/blob/main/src/schemas/transaction.yaml#L274
export interface TransactionOptions {
  type?: string;
  nonce?: bigint;
  from?: Address;
  /**
   * Gas limit
   */
  gas?: bigint;
  value?: bigint;
  /**
   * The gas price willing to be paid by the sender in wei
   */
  gasPrice?: bigint;
  /**
   * Maximum fee per gas the sender is willing to pay to miners in wei
   */
  maxPriorityFeePerGas?: bigint;
  /**
   * The maximum total fee per gas the sender is willing to pay (includes the
   * network / base fee and miner / priority fee) in wei
   */
  maxFeePerGas?: bigint;
  /**
   * EIP-2930 access list
   */
  accessList?: readonly {
    address: Address;
    storageKeys: readonly HexString[];
  }[];
  /**
   * Chain ID that this transaction is valid on.
   */
  chainId?: number;
}

// https://github.com/ethereum/execution-apis/blob/7c9772f95c2472ccfc6f6128dc2e1b568284a2da/src/schemas/transaction.yaml#L1
export interface Eip4844Options {
  /**
   * The maximum total fee per gas the sender is willing to pay for blob gas in
   * wei
   */
  maxFeePerBlobGas?: bigint;
  /**
   * List of versioned blob hashes associated with the transaction's EIP-4844 data blobs.
   */
  blobVersionedHashes?: readonly Hash[];
  blobs?: readonly Bytes[];
}
