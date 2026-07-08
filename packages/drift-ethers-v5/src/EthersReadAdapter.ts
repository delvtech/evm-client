import {
  type Abi,
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
  prepareCall,
  prepareParams,
  type ReadAdapter,
  type Transaction,
  type TransactionReceipt,
  toHexString,
  type WaitForTransactionParams,
} from "@gud/drift";
import {
  BigNumber,
  Contract,
  type EventFilter,
  getDefaultProvider,
  providers,
} from "ethers";
import type { AccessList } from "ethers/lib/utils";
import type { EthersAbi, Provider } from "src/types";

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
      ? (new providers.Web3Provider(
          (globalThis as any).ethereum,
        ) as Provider as TProvider)
      : (getDefaultProvider() as Provider as TProvider),
  }: EthersReadAdapterParams<TProvider> = {}) {
    super();
    this.provider =
      typeof provider === "string"
        ? (new providers.JsonRpcProvider(provider) as Provider as TProvider)
        : provider;
  }

  async getChainId() {
    const { chainId } = await this.provider.getNetwork();
    return chainId;
  }

  async getBlockNumber() {
    const num = await this.provider.getBlockNumber();
    return BigInt(num);
  }

  async getBlock<T extends BlockIdentifier | undefined = undefined>(
    blockId?: T,
  ) {
    const ethersBlock = await this.provider.getBlock(blockParam(blockId));

    if (!ethersBlock) {
      return undefined as GetBlockReturn<T>;
    }

    const block: Block<any> = {
      extraData: ethersBlock.extraData,
      gasLimit: ethersBlock.gasLimit.toBigInt(),
      gasUsed: ethersBlock.gasUsed.toBigInt(),
      hash: ethersBlock.hash,
      logsBloom: undefined,
      miner: ethersBlock.miner,
      mixHash: undefined,
      nonce: BigInt(ethersBlock.nonce),
      number: BigInt(ethersBlock.number),
      parentHash: ethersBlock.parentHash,
      receiptsRoot: undefined,
      sha3Uncles: undefined,
      size: undefined,
      stateRoot: undefined,
      timestamp: BigInt(ethersBlock.timestamp),
      transactions: ethersBlock.transactions,
      transactionsRoot: undefined,
    };

    return block as GetBlockReturn<T>;
  }

  async getBalance({ address, block }: GetBalanceParams) {
    const balance = await this.provider.getBalance(address, blockParam(block));
    return balance.toBigInt();
  }

  getBytecode({ address, block }: GetBytecodeParams) {
    return this.provider.getCode(address, blockParam(block));
  }

  async getGasPrice(): Promise<bigint> {
    const gasPrice = await this.provider.getGasPrice();
    return gasPrice.toBigInt();
  }

  async getTransaction({ hash }: GetTransactionParams) {
    const ethersTx = await this.provider.getTransaction(hash);
    const tx: Transaction | undefined = ethersTx
      ? {
          blockHash: ethersTx.blockHash,
          blockNumber:
            ethersTx.blockNumber !== undefined
              ? BigInt(ethersTx.blockNumber)
              : undefined,
          chainId: Number(ethersTx.chainId),
          from: ethersTx.from,
          gas: ethersTx.gasLimit.toBigInt(),
          gasPrice: ethersTx.gasPrice?.toBigInt(),
          transactionHash: ethersTx.hash,
          input: ethersTx.data,
          nonce: BigInt(ethersTx.nonce),
          to: ethersTx.to ?? undefined,
          transactionIndex: undefined,
          type:
            ethersTx.type !== undefined && ethersTx.type !== null
              ? toHexString(ethersTx.type)
              : undefined,
          value: ethersTx.value.toBigInt(),
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
          cumulativeGasUsed: ethersReceipt.cumulativeGasUsed.toBigInt(),
          effectiveGasPrice: ethersReceipt.effectiveGasPrice.toBigInt(),
          from: ethersReceipt.from,
          gasUsed: ethersReceipt.gasUsed.toBigInt(),
          logs: ethersReceipt.logs.map((log) => ({
            address: log.address,
            blockHash: log.blockHash,
            blockNumber: BigInt(log.blockNumber),
            data: log.data,
            logIndex: log.logIndex,
            removed: log.removed ?? false,
            topics: [...log.topics],
            transactionHash: log.transactionHash,
            transactionIndex: log.transactionIndex,
          })),
          logsBloom: ethersReceipt.logsBloom,
          status: ethersReceipt.status ? "success" : "reverted",
          to: ethersReceipt.to ?? undefined,
          transactionHash: ethersReceipt.transactionHash,
          transactionIndex: ethersReceipt.transactionIndex,
        }
      : undefined;
    return receipt;
  }

  async call({
    accessList,
    block,
    bytecode,
    chainId,
    data,
    gas,
    nonce,
    type,
    ...rest
  }: CallParams) {
    if (bytecode && data) {
      data = encodeBytecodeCallData(bytecode, data);
    }
    return this.provider.call(
      {
        accessList: accessList as AccessList,
        data,
        gasLimit: gas,
        nonce: nonce !== undefined ? Number(nonce) : undefined,
        type: type !== undefined ? Number(type) : undefined,
        ...rest,
      },
      block !== undefined ? blockParam(block) : undefined,
    );
  }

  async estimateGas<
    TAbi extends Abi,
    TFunctionName extends FunctionName<TAbi, "nonpayable" | "payable">,
  >(params: EstimateGasParams<TAbi, TFunctionName>) {
    const { gas, nonce, type, ...rest } = params;
    const { to, data } = prepareCall(params);
    const estimate = await this.provider.estimateGas({
      ...rest,
      data,
      gasLimit: gas,
      nonce: nonce !== undefined ? Number(nonce) : undefined,
      to,
      type: type !== undefined ? Number(type) : undefined,
    });
    return estimate.toBigInt();
  }

  async sendRawTransaction(transaction: Bytes) {
    const tx = await this.provider.sendTransaction(transaction);
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
    const contract = new Contract(address, abi as EthersAbi, this.provider);

    let eventFilter: string | EventFilter = eventName;
    if (filter) {
      const { params } = prepareParams({
        abi: abi,
        type: "event",
        name: eventName,
        kind: "inputs",
        value: filter as EventArgs<TAbi, TEventName>,
      });
      eventFilter = contract.filters[eventName]!(...params);
    }

    const events = await contract.queryFilter(
      eventFilter,
      blockParam(fromBlock),
      blockParam(toBlock),
    );
    return events.map((event) => {
      return {
        address: event.address,
        args: arrayToObject({
          abi: abi,
          kind: "inputs",
          name: eventName,
          values: event.args?.map((arg) =>
            BigNumber.isBigNumber(arg) ? arg.toBigInt() : arg,
          ) as any,
        }),
        blockHash: event.blockHash,
        blockNumber: BigInt(event.blockNumber),
        data: event.data,
        eventName: event.event as TEventName,
        logIndex: event.logIndex,
        removed: event.removed,
        topics: event.topics,
        transactionHash: event.transactionHash,
        transactionIndex: event.transactionIndex,
      } satisfies EventLog<TAbi, TEventName>;
    });
  }
}

function blockParam(block?: bigint | string): string {
  if (block === undefined) return "latest";
  if (typeof block === "bigint") return toHexString(block);
  return block;
}
