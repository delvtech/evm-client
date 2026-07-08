import {
  type Abi,
  type AbiArrayType,
  arrayToObject,
  BaseReadAdapter,
  type Block,
  type BlockIdentifier,
  type Bytes,
  type CallParams,
  type EstimateGasParams,
  type EventArgs,
  type EventLog,
  type EventName,
  encodeBytecodeCallData,
  type FunctionName,
  type GetBalanceParams,
  type GetBlockReturn,
  type GetBytecodeParams,
  type GetEventsParams,
  type GetTransactionParams,
  type Hash,
  prepareCall,
  prepareParams,
  type ReadAdapter,
  type Transaction,
  type TransactionReceipt,
  toHexString,
  type WaitForTransactionParams,
} from "@gud/drift";
import type { AccessList } from "ethers";
import {
  BrowserProvider,
  Contract,
  type DeferredTopicFilter,
  type EventLog as EthersEventLog,
  getDefaultProvider,
  type InterfaceAbi,
  JsonRpcProvider,
  type Provider,
} from "ethers";

export interface EthersReadAdapterParams<
  TProvider extends Provider = Provider,
> {
  /**
   * Ethers Provider instance or RPC URL.
   */
  provider?: TProvider | string;
}

export class EthersReadAdapter<TProvider extends Provider = Provider>
  extends BaseReadAdapter
  implements ReadAdapter
{
  provider: TProvider;

  constructor({
    provider = "ethereum" in globalThis
      ? (new BrowserProvider(
          (globalThis as any).ethereum,
        ) as Provider as TProvider)
      : (getDefaultProvider() as Provider as TProvider),
  }: EthersReadAdapterParams<TProvider> = {}) {
    super();
    this.provider =
      typeof provider === "string"
        ? (new JsonRpcProvider(provider) as Provider as TProvider)
        : provider;
  }

  async getChainId() {
    const { chainId } = await this.provider.getNetwork();
    return Number(chainId);
  }

  async getBlockNumber() {
    const num = await this.provider.getBlockNumber();
    return BigInt(num);
  }

  async getBlock<T extends BlockIdentifier | undefined = undefined>(
    blockId?: T,
  ) {
    const ethersBlock = await this.provider.getBlock(blockId ?? "latest");

    if (!ethersBlock) {
      return undefined as GetBlockReturn<T>;
    }

    const block: Block<any> = {
      extraData: ethersBlock.extraData,
      gasLimit: ethersBlock.gasLimit,
      gasUsed: ethersBlock.gasUsed,
      hash: ethersBlock.hash,
      logsBloom: undefined,
      miner: ethersBlock.miner,
      mixHash: undefined,
      nonce: BigInt(ethersBlock.nonce),
      number: BigInt(ethersBlock.number),
      parentHash: ethersBlock.parentHash,
      receiptsRoot: ethersBlock.receiptsRoot ?? undefined,
      sha3Uncles: undefined,
      size: undefined,
      stateRoot: ethersBlock.stateRoot ?? "0x",
      timestamp: BigInt(ethersBlock.timestamp),
      transactions: ethersBlock.transactions.slice(),
      transactionsRoot: undefined,
    };

    return block as GetBlockReturn<T>;
  }

  getBalance({ address, block }: GetBalanceParams) {
    return this.provider.getBalance(address, block);
  }

  getBytecode({ address, block }: GetBytecodeParams) {
    return this.provider.getCode(address, block);
  }

  async getGasPrice(): Promise<bigint> {
    const feeData = await this.provider.getFeeData();
    return feeData.gasPrice ?? BigInt(0);
  }

  async getTransaction({ hash }: GetTransactionParams) {
    const ethersTx = await this.provider.getTransaction(hash);
    const tx: Transaction | undefined = ethersTx
      ? {
          blockHash: ethersTx.blockHash ?? undefined,
          blockNumber:
            ethersTx.blockNumber !== null
              ? BigInt(ethersTx.blockNumber)
              : undefined,
          chainId: Number(ethersTx.chainId),
          from: ethersTx.from,
          gas: ethersTx.gasLimit,
          gasPrice: ethersTx.gasPrice,
          transactionHash: ethersTx.hash,
          input: ethersTx.data,
          nonce: BigInt(ethersTx.nonce),
          to: ethersTx.to ?? undefined,
          transactionIndex: ethersTx.index,
          type: toHexString(ethersTx.type),
          value: ethersTx.value,
        }
      : undefined;
    return tx;
  }

  async waitForTransaction({ hash, timeout }: WaitForTransactionParams) {
    const ethersReceipt = await this.provider.waitForTransaction(
      hash,
      undefined,
      timeout,
    );
    const receipt: TransactionReceipt | undefined = ethersReceipt
      ? {
          contractAddress: ethersReceipt.contractAddress ?? undefined,
          blockHash: ethersReceipt.blockHash,
          blockNumber: BigInt(ethersReceipt.blockNumber),
          cumulativeGasUsed: ethersReceipt.cumulativeGasUsed,
          effectiveGasPrice: ethersReceipt.gasPrice,
          from: ethersReceipt.from,
          gasUsed: ethersReceipt.gasUsed,
          logs: ethersReceipt.logs.map((log) => ({
            address: log.address,
            blockHash: log.blockHash,
            blockNumber: BigInt(log.blockNumber),
            data: log.data,
            logIndex: log.index,
            removed: log.removed ?? false,
            topics: [...log.topics],
            transactionHash: log.transactionHash,
            transactionIndex: log.transactionIndex,
          })),
          logsBloom: ethersReceipt.logsBloom,
          status: ethersReceipt.status ? "success" : "reverted",
          to: ethersReceipt?.to ?? undefined,
          transactionHash: ethersReceipt.hash,
          transactionIndex: ethersReceipt.index,
        }
      : undefined;
    return receipt;
  }

  async call({
    accessList,
    blobs,
    blobVersionedHashes,
    block,
    bytecode,
    data,
    gas,
    nonce,
    type,
    ...rest
  }: CallParams) {
    if (bytecode && data) {
      data = encodeBytecodeCallData(bytecode, data);
    }
    return this.provider.call({
      ...rest,
      accessList: accessList as AccessList,
      blobs: blobs as Bytes[],
      blobVersionedHashes: blobVersionedHashes as Hash[],
      blockTag: block,
      data,
      gasLimit: gas,
      nonce: nonce !== undefined ? Number(nonce) : undefined,
      type: type !== undefined ? Number(type) : undefined,
    });
  }

  async estimateGas<
    TAbi extends Abi,
    TFunctionName extends FunctionName<TAbi, "nonpayable" | "payable">,
  >(params: EstimateGasParams<TAbi, TFunctionName>) {
    const { block, gas, nonce, type, ...rest } = params;
    const { to, data } = prepareCall(params);
    return this.provider.estimateGas({
      ...rest,
      blockTag: block,
      data,
      gasLimit: gas,
      nonce: nonce !== undefined ? Number(nonce) : undefined,
      to,
      type: type !== undefined ? Number(type) : undefined,
    });
  }

  async sendRawTransaction(transaction: Bytes) {
    const tx = await this.provider.broadcastTransaction(transaction);
    return tx.hash;
  }

  async getEvents<TAbi extends Abi, TEventName extends EventName<TAbi>>({
    abi,
    address,
    event: eventName,
    filter,
    fromBlock,
    toBlock,
  }: GetEventsParams<TAbi, TEventName>) {
    const contract = new Contract(address, abi as InterfaceAbi, this.provider);

    let eventFilter: string | DeferredTopicFilter = eventName;
    if (filter) {
      const { params } = prepareParams({
        abi: abi,
        type: "event",
        name: eventName,
        kind: "inputs",
        value: filter as EventArgs<TAbi, TEventName>,
      });
      eventFilter = contract.getEvent(eventName)(...params);
    }

    const events = (await contract.queryFilter(
      eventFilter,
      fromBlock,
      toBlock,
    )) as EthersEventLog[];

    return events.map((event) => {
      return {
        address: event.address,
        args: arrayToObject({
          abi: abi,
          kind: "inputs",
          name: eventName,
          values: event.args as unknown[] as AbiArrayType<
            TAbi,
            "event",
            TEventName
          >,
        }),
        blockHash: event.blockHash,
        blockNumber: BigInt(event.blockNumber),
        data: event.data,
        eventName: event.eventName as TEventName,
        logIndex: event.index,
        removed: event.removed,
        topics: event.topics as Hash[],
        transactionHash: event.transactionHash,
        transactionIndex: event.transactionIndex,
      } satisfies EventLog<TAbi, TEventName>;
    });
  }
}

declare module "@gud/drift" {
  interface BlockOverrides<T> {
    /**
     * Unavailable in ethers.js.
     */
    mixHash: undefined;
    /**
     * Possibly undefined in ethers.js.
     */
    receiptsRoot: Hash | undefined;
    /**
     * Unavailable in ethers.js.
     */
    sha3Uncles: undefined;
    /**
     * Unavailable in ethers.js.
     */
    size: undefined;
    /**
     * Unavailable in ethers.js.
     */
    transactionsRoot: undefined;
  }

  interface TransactionReceipt {
    /**
     * ___
     * __Note:__ The ethers.js implementation of this field maps to the
     * `gasPrice` field of a {@linkcode TransactionResponse} object.
     *
     * @see [Ethers.js - TransactionResponse - gasPrice](https://docs.ethers.org/v6/api/providers/#TransactionResponse-gasPrice)
     */
    effectiveGasPrice: bigint;
  }
}

declare module "@gud/drift" {
  interface BaseTypeOverrides {
    HexString: string;
  }
}
