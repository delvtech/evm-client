import {
  AbiEvent,
  Address,
  Block,
  Provider,
  RpcTransport,
  Transaction,
  TransactionReceipt,
} from "ox";
import {
  type BaseAdapterOptions,
  BaseReadAdapter,
} from "src/adapter/BaseAdapter";
import { deploy } from "src/adapter/methods/deploy";
import { write } from "src/adapter/methods/write";
import type {
  Abi,
  Address as AddressType,
  Bytes,
  Hash,
  HexString,
} from "src/adapter/types/Abi";
import type {
  CallParams,
  DeployParams,
  EstimateGasParams,
  GetBalanceParams,
  GetBlockReturn,
  GetBytecodeParams,
  GetEventsParams,
  GetTransactionParams,
  GetWalletCapabilitiesParams,
  ReadAdapter,
  ReadWriteAdapter,
  SendCallsParams,
  SendCallsReturn,
  SendTransactionParams,
  WaitForTransactionParams,
  WalletCallsStatus,
  WalletCapabilities,
  WriteParams,
} from "src/adapter/types/Adapter";
import type { BlockIdentifier, BlockTag } from "src/adapter/types/Block";
import type { EventArgs, EventLog, EventName } from "src/adapter/types/Event";
import type { WriteFunctionName } from "src/adapter/types/Function";
import type {
  Eip4844Options,
  TransactionOptions,
  TransactionReceipt as TransactionReceiptType,
  Transaction as TransactionType,
  WalletCallsReceipt,
} from "src/adapter/types/Transaction";
import { encodeBytecodeCallData } from "src/adapter/utils/encodeBytecodeCallData";
import { getWalletCallsStatusLabel } from "src/adapter/utils/getWalletCallsStatusLabel";
import { handleError } from "src/adapter/utils/internal/handleError";
import { prepareCall } from "src/adapter/utils/prepareCall";
import { prepareParams } from "src/adapter/utils/prepareParams";
import { DriftError } from "src/error/DriftError";
import { convert } from "src/utils/convert";
import { isHexString, toHexString } from "src/utils/hex";

export interface DefaultAdapterOptions extends BaseAdapterOptions {
  rpcUrl?: string;
}

export class DefaultReadAdapter extends BaseReadAdapter implements ReadAdapter {
  provider: Provider.Provider;

  constructor({ rpcUrl, ...baseOptions }: DefaultAdapterOptions = {}) {
    super(baseOptions);
    try {
      const provider = rpcUrl
        ? RpcTransport.fromHttp(rpcUrl)
        : globalThis.ethereum;

      if (!provider) {
        throw new DriftError("No provider found");
      }

      this.provider = Provider.from(provider);
    } catch (e) {
      handleError(e);
    }
  }

  getChainId() {
    return this.provider
      .request({ method: "eth_chainId" })
      .then(Number)
      .catch(handleError);
  }

  getBlockNumber() {
    return this.provider
      .request({ method: "eth_blockNumber" })
      .then(BigInt)
      .catch(handleError);
  }

  getBlock<T extends BlockIdentifier | undefined = undefined>(
    blockId?: T,
  ): Promise<GetBlockReturn<T>> {
    return this.provider
      .request(
        isHexString(blockId)
          ? {
              method: "eth_getBlockByHash",
              params: [blockId, false],
            }
          : {
              method: "eth_getBlockByNumber",
              params: [prepareBlockParam(blockId), false],
            },
      )
      .then(Block.fromRpc)
      .then((block) =>
        block
          ? {
              ...block,
              nonce: BigInt(block.nonce),
              transactions: block.transactions.slice(),
            }
          : undefined,
      )
      .catch(handleError) as Promise<GetBlockReturn<T>>;
  }

  getBalance({ address, block }: GetBalanceParams): Promise<bigint> {
    return this.provider
      .request({
        method: "eth_getBalance",
        params: [address, prepareBlockParam(block)],
      })
      .then(BigInt)
      .catch(handleError);
  }

  getBytecode({
    address,
    block,
  }: GetBytecodeParams): Promise<Bytes | undefined> {
    return this.provider
      .request({
        method: "eth_getCode",
        params: [address, prepareBlockParam(block)],
      })
      .then((code) => (code === "0x" ? undefined : code))
      .catch(handleError);
  }

  getGasPrice(): Promise<bigint> {
    return this.provider
      .request({ method: "eth_gasPrice" })
      .then(BigInt)
      .catch(handleError);
  }

  getTransaction({
    hash,
  }: GetTransactionParams): Promise<TransactionType | undefined> {
    return this.provider
      .request({
        method: "eth_getTransactionByHash",
        params: [hash],
      })
      .then((tx) => {
        if (!tx) return undefined;
        const { to, hash, ...rest } = Transaction.fromRpc(tx);
        return {
          to: to || undefined,
          transactionHash: hash,
          ...rest,
        };
      })
      .catch(handleError);
  }

  waitForTransaction({
    hash,
    timeout = this.pollingTimeout,
  }: WaitForTransactionParams) {
    return new Promise<TransactionReceiptType | undefined>(
      (resolve, reject) => {
        const getReceipt = (): any =>
          this.provider
            .request({
              method: "eth_getTransactionReceipt",
              params: [hash],
            })
            .then((receipt) => {
              if (receipt) {
                const { to, contractAddress, logs, ...rest } =
                  TransactionReceipt.fromRpc(receipt);
                resolve({
                  to: to || undefined,
                  contractAddress: contractAddress || undefined,
                  logs: logs.map((log) => ({
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
                  ...rest,
                });
              } else {
                setTimeout(getReceipt, this.pollingInterval);
              }
            })
            .catch(reject);

        getReceipt();
        setTimeout(() => resolve(undefined), timeout);
      },
    ).catch(handleError);
  }

  sendRawTransaction(transaction: Bytes): Promise<Hash> {
    return this.provider.request({
      method: "eth_sendRawTransaction",
      params: [transaction],
    });
  }

  getEvents<TAbi extends Abi, TEventName extends EventName<TAbi>>({
    abi,
    address,
    event,
    filter,
    fromBlock,
    toBlock,
  }: GetEventsParams<TAbi, TEventName>): Promise<EventLog<TAbi, TEventName>[]> {
    const { abiEntry } = prepareParams({
      abi,
      type: "event",
      name: event,
      kind: "inputs",
      value: filter as EventArgs<TAbi, TEventName>,
    });

    return this.provider
      .request({
        method: "eth_getLogs",
        params: [
          {
            address,
            fromBlock: prepareBlockParam(fromBlock),
            toBlock: prepareBlockParam(toBlock),
            topics: AbiEvent.encode(abiEntry, filter || {}).topics,
          },
        ],
      })
      .then((logs) =>
        logs.map((log) => {
          return {
            address: log.address,
            args: AbiEvent.decode(abiEntry, log) as EventArgs<TAbi, TEventName>,
            blockHash: log.blockHash,
            blockNumber: BigInt(log.blockNumber),
            data: log.data,
            eventName: event,
            logIndex: Number(log.logIndex),
            removed: log.removed,
            topics: log.topics,
            transactionHash: log.transactionHash,
            transactionIndex:
              log.transactionIndex !== undefined
                ? Number(log.transactionIndex)
                : undefined,
          };
        }),
      )
      .catch(handleError);
  }

  call({ to, data, bytecode, block, ...options }: CallParams): Promise<Bytes> {
    if (bytecode && data) {
      data = encodeBytecodeCallData(bytecode, data);
    }

    return this.provider
      .request({
        method: "eth_call",
        params: [
          { ...prepareTransactionOptions(options), to, data },
          prepareBlockParam(block),
        ],
      })
      .catch(handleError);
  }

  estimateGas<TAbi extends Abi, TFunctionName extends WriteFunctionName<TAbi>>(
    params: EstimateGasParams<TAbi, TFunctionName>,
  ): Promise<bigint> {
    const { to, data } = prepareCall(params);
    const { block, ...rest } = params;

    return this.provider
      .request({
        method: "eth_estimateGas",
        params: [
          { ...prepareTransactionOptions(rest), data, to },
          prepareBlockParam(block),
        ],
      })
      .then(BigInt)
      .catch(handleError);
  }
}

export class DefaultAdapter
  extends DefaultReadAdapter
  implements ReadWriteAdapter
{
  getSignerAddress(): Promise<AddressType> {
    return this.provider
      .request({ method: "eth_accounts" })
      .then(([address]) => {
        if (!address) throw new DriftError("No signer address found");
        return Address.checksum(address);
      })
      .catch(handleError);
  }

  async call(params: CallParams): Promise<Bytes> {
    return super.call({
      from:
        params.from || (await this.getSignerAddress().catch(() => undefined)),
      ...params,
    });
  }

  async getWalletCapabilities<TChainIds extends readonly number[]>(
    params?: GetWalletCapabilitiesParams<TChainIds>,
  ) {
    return this.provider
      .request({
        method: "wallet_getCapabilities",
        params: [
          params?.address || (await this.getSignerAddress()),
          (params?.chainIds?.map((id) => toHexString(id)) || [
            toHexString(await this.getChainId()),
          ]) as HexString[] | undefined,
        ],
      })
      .then((capabilities) => {
        return Object.fromEntries(
          Object.entries(capabilities).map(([key, value]) => [
            Number(key),
            value,
          ]),
        ) as WalletCapabilities<TChainIds>;
      })
      .catch(handleError);
  }

  getCallsStatus<TId extends HexString>(
    batchId: TId,
  ): Promise<WalletCallsStatus<TId>> {
    return this.provider
      .request({
        method: "wallet_getCallsStatus",
        params: [batchId],
      })
      .then(({ chainId, id, receipts, status, ...rest }) => {
        return {
          chainId: Number(chainId),
          id: id as TId,
          statusCode: status,
          status: getWalletCallsStatusLabel(status),
          receipts: receipts?.map(
            ({ blockNumber, gasUsed, status, ...rest }) => {
              return {
                blockNumber: BigInt(blockNumber),
                gasUsed: BigInt(gasUsed),
                status: status === "0x1" ? "success" : "reverted",
                ...rest,
              } satisfies WalletCallsReceipt;
            },
          ),
          ...rest,
        };
      })
      .catch(handleError);
  }

  showCallsStatus(batchId: HexString): Promise<void> {
    return this.provider
      .request({
        method: "wallet_showCallsStatus",
        params: [batchId],
      })
      .catch(handleError);
  }

  async sendTransaction({
    data,
    to,
    from,
    onMined,
    onMinedTimeout,
    ...options
  }: SendTransactionParams): Promise<Hash> {
    return this.provider
      .request({
        method: "eth_sendTransaction",
        params: [
          {
            ...prepareTransactionOptions(options),
            data,
            to,
            from: from || (await this.getSignerAddress().catch(handleError)),
          },
        ],
      })
      .then((hash) => {
        if (onMined) {
          this.waitForTransaction({
            hash,
            timeout: onMinedTimeout,
          }).then(onMined);
        }
        return hash;
      })
      .catch(handleError);
  }

  deploy<TAbi extends Abi>(params: DeployParams<TAbi>): Promise<Hash> {
    return deploy(this, params);
  }

  write<TAbi extends Abi, TFunctionName extends WriteFunctionName<TAbi>>(
    params: WriteParams<TAbi, TFunctionName>,
  ): Promise<Hash> {
    return write(this, params);
  }

  async sendCalls<const TCalls extends readonly unknown[] = any[]>(
    params: SendCallsParams<TCalls>,
  ): Promise<SendCallsReturn> {
    return this.provider
      .request({
        method: "wallet_sendCalls",
        params: [
          {
            version: params.version || "2.0.0",
            id: params.id,
            chainId: toHexString(params.chainId ?? (await this.getChainId())),
            from: params.from || (await this.getSignerAddress()),
            atomicRequired: params.atomic ?? true,
            calls: params.calls.map(({ capabilities, value, ...call }) => {
              const { to, data } = prepareCall(call);
              return {
                to,
                data,
                capabilities,
                value: value !== undefined ? toHexString(value) : undefined,
              };
            }),
            capabilities: params.capabilities,
          },
        ],
      })
      .catch(handleError) as Promise<SendCallsReturn>;
  }
}

function prepareBlockParam(block?: BlockIdentifier): HexString | BlockTag {
  if (block === undefined) return "latest";
  if (typeof block === "bigint") return toHexString(block);
  return block;
}

function prepareTransactionOptions({
  // Whitelist fields to avoid extra properties
  accessList,
  blobs,
  blobVersionedHashes,
  chainId,
  from,
  gas,
  gasPrice,
  maxFeePerBlobGas,
  maxFeePerGas,
  maxPriorityFeePerGas,
  nonce,
  type,
  value,
}: TransactionOptions & Eip4844Options) {
  return convert(
    {
      accessList,
      blobs,
      blobVersionedHashes,
      chainId,
      from,
      gas,
      gasPrice,
      maxFeePerBlobGas,
      maxFeePerGas,
      maxPriorityFeePerGas,
      nonce,
      type,
      value,
      // Ensure no fields from the type are omitted
    } satisfies Record<keyof (TransactionOptions & Eip4844Options), any>,
    (value) => typeof value === "bigint" || typeof value === "number",
    (value): HexString => toHexString(value),
  );
}

declare global {
  var ethereum: Provider.Provider | undefined;
}
