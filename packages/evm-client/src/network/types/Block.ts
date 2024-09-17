export interface Block {
  /** `null` if pending */
  blockNumber: bigint | null;
  timestamp: bigint;
}

// https://github.com/ethereum/execution-apis/blob/3ae3d29fc9900e5c48924c238dff7643fdc3680e/src/schemas/block.yaml#L114
export type BlockTag = 'latest' | 'earliest' | 'pending' | 'safe' | 'finalized';
