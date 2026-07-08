import {
  type Abi,
  BaseReadAdapter,
  type Block,
  type BlockIdentifier,
  type Bytes,
  type CallParams,
  type EstimateGasParams,
  type EventArgs,
  type EventLog,
  type EventName,
  type FunctionName,
  type GetBalanceParams,
  type GetBlockReturn,
  type GetBytecodeParams,
  type GetEventsParams,
  type GetTransactionParams,
  prepareCall,
  type ReadAdapter,
  type TransactionReceipt,
  type WaitForTransactionParams,
} from "@gud/drift";
import {
  type AnyClient,
  type CoercedPublicClient,
  coercePublicClient,
} from "src/publicClient";
import {
  type CallParameters,
  type ContractEventName,
  decodeEventLog,
  type GetBalanceParameters,
  type GetCodeParameters,
  isHex,
  type PublicClient,
  rpcTransactionType,
} from "viem";

export interface ViemReadAdapterParams<TClient extends AnyClient = AnyClient> {
  publicClient: TClient;
}

export class ViemReadAdapter<TClient extends AnyClient = PublicClient>
  extends BaseReadAdapter
  implements ReadAdapter
{
  publicClient: CoercedPublicClient<TClient>;

  constructor({ publicClient }: ViemReadAdapterParams<TClient>) {
    super();
    this.publicClient = coercePublicClient(publicClient);
  }

  getChainId() {
    return this.publicClient.getChainId();
  }

  getBlockNumber() {
    return this.publicClient.getBlockNumber();
  }

  async getBlock<T extends BlockIdentifier | undefined = undefined>(
    blockId?: T,
  ) {
    const viemBlock = await this.publicClient.getBlock(
      isHex(blockId)
        ? {
            blockHash: blockId,
          }
        : typeof blockId === "string"
          ? {
              blockTag: blockId,
            }
          : {
              blockNumber: blockId,
            },
    );

    const block: Block<any> = {
      extraData: viemBlock.extraData,
      gasLimit: viemBlock.gasLimit,
      gasUsed: viemBlock.gasUsed,
      hash: viemBlock.hash ?? undefined,
      logsBloom: viemBlock.logsBloom ?? undefined,
      miner: viemBlock.miner,
      mixHash: viemBlock.mixHash,
      nonce: viemBlock.nonce !== null ? BigInt(viemBlock.nonce) : undefined,
      number: viemBlock.number ?? undefined,
      parentHash: viemBlock.parentHash,
      receiptsRoot: viemBlock.receiptsRoot,
      sha3Uncles: viemBlock.sha3Uncles,
      size: viemBlock.size,
      stateRoot: viemBlock.stateRoot,
      timestamp: viemBlock.timestamp,
      transactions: viemBlock.transactions,
      transactionsRoot: viemBlock.transactionsRoot,
    };

    return block as GetBlockReturn<T>;
  }

  getBalance({ address, block }: GetBalanceParams) {
    return this.publicClient.getBalance({
      address,
      blockNumber: typeof block === "bigint" ? block : undefined,
      blockTag: typeof block === "string" ? block : undefined,
    } as GetBalanceParameters);
  }

  getBytecode({ address, block }: GetBytecodeParams) {
    return this.publicClient.getCode({
      address,
      blockNumber: typeof block === "bigint" ? block : undefined,
      blockTag: typeof block === "string" ? block : undefined,
    } as GetCodeParameters);
  }

  getGasPrice() {
    return this.publicClient.getGasPrice();
  }

  async getTransaction({ hash }: GetTransactionParams) {
    const tx = await this.publicClient.getTransaction({ hash });
    return {
      gas: tx.gas,
      gasPrice: tx.gasPrice ?? 0n,
      input: tx.input,
      nonce: BigInt(tx.nonce),
      type: rpcTransactionType[tx.type],
      value: tx.value,
      blockHash: tx.blockHash ?? undefined,
      blockNumber: tx.blockNumber ?? undefined,
      from: tx.from,
      chainId: tx.chainId,
      transactionHash: tx.hash,
      to: tx.to ?? undefined,
      transactionIndex: tx.transactionIndex,
    };
  }

  async waitForTransaction({
    hash,
    timeout,
  }: WaitForTransactionParams): Promise<TransactionReceipt> {
    const receipt = await this.publicClient.waitForTransactionReceipt({
      hash,
      timeout,
    });
    return {
      blockHash: receipt.blockHash,
      blockNumber: receipt.blockNumber,
      contractAddress: receipt.contractAddress ?? undefined,
      cumulativeGasUsed: receipt.cumulativeGasUsed,
      effectiveGasPrice: receipt.effectiveGasPrice,
      from: receipt.from,
      gasUsed: receipt.gasUsed,
      logs: receipt.logs.map((log) => ({
        address: log.address,
        blockHash: log.blockHash ?? undefined,
        blockNumber: log.blockNumber ?? undefined,
        data: log.data,
        logIndex: log.logIndex ?? undefined,
        removed: log.removed,
        topics: [...log.topics],
        transactionHash: log.transactionHash ?? undefined,
        transactionIndex: log.transactionIndex ?? undefined,
      })),
      logsBloom: receipt.logsBloom,
      status: receipt.status,
      to: receipt.to ?? undefined,
      transactionHash: receipt.transactionHash,
      transactionIndex: receipt.transactionIndex,
    };
  }

  async getEvents<TAbi extends Abi, TEventName extends EventName<TAbi>>({
    abi,
    address,
    event: eventName,
    filter,
    fromBlock,
    toBlock,
  }: GetEventsParams<TAbi, TEventName>) {
    const events = await this.publicClient.getContractEvents({
      address,
      abi: abi as Abi,
      eventName: eventName as string,
      fromBlock,
      toBlock,
      args: filter,
    });
    return events.map((event) => {
      const objectArgs = (
        Array.isArray(event.args)
          ? decodeEventLog({
              abi,
              eventName: event.eventName as ContractEventName<TAbi>,
              data: event.data,
              topics: event.topics,
            }).args
          : event.args
      ) as EventArgs<TAbi, TEventName>;
      return {
        address: event.address,
        args: objectArgs,
        blockHash: event.blockHash ?? undefined,
        blockNumber: event.blockNumber ?? undefined,
        data: event.data,
        eventName,
        logIndex: event.logIndex ?? undefined,
        removed: event.removed,
        topics: event.topics,
        transactionHash: event.transactionHash ?? undefined,
        transactionIndex: event.transactionIndex ?? undefined,
      } satisfies EventLog<TAbi, TEventName>;
    });
  }

  async call({ block, bytecode, from, nonce, ...rest }: CallParams) {
    const { data } = await this.publicClient.call({
      blockNumber: typeof block === "bigint" ? block : undefined,
      // TODO: Block hash not supported?
      blockTag: typeof block === "string" ? block : undefined,
      code: bytecode,
      account: from,
      nonce: typeof nonce === "bigint" ? Number(nonce) : nonce,
      ...rest,
    } as CallParameters);
    return data || "0x";
  }

  estimateGas<
    TAbi extends Abi,
    TFunctionName extends FunctionName<TAbi, "nonpayable" | "payable">,
  >(params: EstimateGasParams<TAbi, TFunctionName>) {
    const { to, data } = prepareCall(params);
    const { block, from, nonce, ...rest } = params;
    return this.publicClient.estimateGas({
      ...rest,
      account: from,
      blockNumber: typeof block === "bigint" ? block : undefined,
      // TODO: Block hash not supported?
      blockTag: typeof block === "string" ? block : undefined,
      data,
      nonce: typeof nonce === "bigint" ? Number(nonce) : nonce,
      to,
    } as CallParameters);
  }

  sendRawTransaction(serializedTransaction: Bytes) {
    return this.publicClient.sendRawTransaction({ serializedTransaction });
  }
}
