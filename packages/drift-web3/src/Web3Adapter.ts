import {
  type Abi,
  type Address,
  type AnyObject,
  BaseReadWriteAdapter,
  type BlockIdentifier,
  type Bytes,
  type CallParams,
  type DeployParams,
  DriftError,
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
  type GetWalletCapabilitiesParams,
  getWalletCallsStatusLabel,
  type Hash,
  type HexString,
  NotImplementedError,
  prepareCall,
  prepareParams,
  type ReadWriteAdapter,
  type SendCallsParams,
  type SendCallsReturn,
  type SendTransactionParams,
  type SimulateWriteParams,
  type Transaction,
  type TransactionReceipt,
  toHexString,
  type WaitForTransactionParams,
  type WalletCallsReceipt,
  type WalletCallsStatus,
  type WalletCapabilities,
  type WriteParams,
} from "@gud/drift";
import {
  type AbiFragment,
  type AccessList,
  TransactionNotFound,
  default as Web3,
} from "web3";

export class Web3Adapter<TWeb3 extends Web3 = Web3>
  extends BaseReadWriteAdapter
  implements ReadWriteAdapter
{
  web3: TWeb3;
  injectedWeb3?: TWeb3;

  constructor(
    web3OrProvider:
      | TWeb3
      | ConstructorParameters<typeof Web3>[0] = new Web3() as TWeb3,
  ) {
    super();
    this.web3 =
      web3OrProvider instanceof Web3
        ? web3OrProvider
        : (new Web3(web3OrProvider as any) as TWeb3);
    if (globalThis.ethereum) {
      this.injectedWeb3 = new Web3(globalThis.ethereum as any) as TWeb3;
    }
  }

  getChainId() {
    return this.web3.eth.getChainId().then(Number);
  }

  getBlockNumber() {
    return this.web3.eth.getBlockNumber();
  }

  async getBlock<T extends BlockIdentifier | undefined = undefined>(
    blockId?: T,
  ) {
    const web3Block = await this.web3.eth.getBlock(blockId);

    const block = web3Block
      ? {
          ...web3Block,
          transactions: web3Block.transactions.map((tx) =>
            typeof tx === "string" ? tx : tx.hash,
          ),
        }
      : undefined;

    return block as GetBlockReturn<T>;
  }

  getBalance({ address, block }: GetBalanceParams) {
    return this.web3.eth.getBalance(address, block);
  }

  getBytecode({ address, block }: GetBytecodeParams) {
    return this.web3.eth.getCode(address, block);
  }

  getGasPrice() {
    return this.web3.eth.getGasPrice();
  }

  async getTransaction({ hash }: GetTransactionParams) {
    const tx = await this.web3.eth.getTransaction(hash);
    return tx
      ? ({
          ...tx,
          blockNumber:
            tx.blockNumber !== undefined ? BigInt(tx.blockNumber) : undefined,
          chainId: tx.chainId !== undefined ? Number(tx.chainId) : undefined,
          gas: BigInt(tx.gas),
          gasPrice: BigInt(tx.gasPrice),
          transactionHash: tx.hash,
          nonce: BigInt(tx.nonce),
          to: tx.to || undefined,
          transactionIndex:
            tx.transactionIndex !== undefined
              ? Number(tx.transactionIndex)
              : undefined,
          type: typeof tx.type === "string" ? tx.type : toHexString(tx.type),
          value: BigInt(tx.value),
        } satisfies Transaction)
      : undefined;
  }

  async waitForTransaction({
    hash,
    timeout = this.web3.transactionPollingTimeout,
  }: WaitForTransactionParams) {
    return new Promise<TransactionReceipt | undefined>((resolve, reject) => {
      const getReceipt = () => {
        this.web3.eth
          .getTransactionReceipt(hash)
          .then((receipt) =>
            receipt
              ? resolve({
                  ...receipt,
                  effectiveGasPrice: receipt.effectiveGasPrice ?? 0n,
                  logs: receipt.logs.map((log) => ({
                    address: log.address ?? "0x",
                    blockHash: log.blockHash,
                    blockNumber:
                      log.blockNumber != null
                        ? BigInt(log.blockNumber)
                        : undefined,
                    data: log.data ?? "0x",
                    logIndex:
                      log.logIndex != null ? Number(log.logIndex) : undefined,
                    removed: log.removed ?? false,
                    topics: log.topics ?? [],
                    transactionHash: log.transactionHash,
                    transactionIndex:
                      log.transactionIndex != null
                        ? Number(log.transactionIndex)
                        : undefined,
                  })),
                  status: receipt.status ? "success" : "reverted",
                  to: receipt.to || undefined,
                  transactionIndex: Number(receipt.transactionIndex),
                })
              : setTimeout(
                  getReceipt,
                  this.web3.transactionReceiptPollingInterval,
                ),
          )
          .catch((e) => {
            if (e instanceof TransactionNotFound) {
              setTimeout(
                getReceipt,
                this.web3.transactionReceiptPollingInterval,
              );
              return;
            }
            reject(e);
          });
      };
      getReceipt();
      setTimeout(() => resolve(undefined), timeout);
    });
  }

  async call({
    accessList,
    block,
    bytecode,
    data,
    from,
    to,
    ...rest
  }: CallParams) {
    if (bytecode && data) {
      data = encodeBytecodeCallData(bytecode, data);
    }
    return this.web3.eth.call(
      {
        accessList: accessList as AccessList,
        data,
        from: from || (await this.getSignerAddress().catch(() => undefined)),
        to: to as string,
        ...rest,
      },
      block,
    );
  }

  async estimateGas<
    TAbi extends Abi,
    TFunctionName extends FunctionName<TAbi, "nonpayable" | "payable">,
  >(params: EstimateGasParams<TAbi, TFunctionName>) {
    const { block, ...rest } = params;
    const { to, data } = prepareCall(params);
    return this.web3.eth.estimateGas(
      {
        ...rest,
        data,
        to,
      },
      block,
    );
  }

  async sendRawTransaction(transaction: Bytes) {
    const tx = await this.web3.eth.sendSignedTransaction(transaction);
    return toHexString(tx.transactionHash);
  }

  async getEvents<TAbi extends Abi, TEventName extends EventName<TAbi>>({
    abi,
    address,
    event: eventName,
    filter,
    fromBlock,
    toBlock,
  }: GetEventsParams<TAbi, TEventName>) {
    const contract = new this.web3.eth.Contract(
      abi as readonly AbiFragment[],
      address,
    );

    const events = await contract.getPastEvents(eventName as any, {
      fromBlock,
      toBlock,
      filter: filter as AnyObject | undefined,
    });

    return events.map((event) => {
      // strings represent filter ids which shouldn't be returned given the
      // current implementation.
      if (typeof event === "string") {
        throw new DriftError(
          `Invalid event object returned from web3.js when getting past ${eventName} events:\n  ${event}\n`,
        );
      }

      return {
        address: event.address,
        args: event.returnValues as EventArgs<TAbi, TEventName>,
        blockHash: event.blockHash,
        blockNumber:
          typeof event.blockNumber === "undefined"
            ? event.blockNumber
            : BigInt(event.blockNumber),
        data: event.data,
        eventName,
        logIndex:
          typeof event.logIndex === "undefined"
            ? event.logIndex
            : Number(event.logIndex),
        removed: false,
        topics: event.topics,
        transactionHash: event.transactionHash,
        transactionIndex: Number(event.transactionIndex),
      } satisfies EventLog<TAbi, TEventName>;
    });
  }

  async getSignerAddress() {
    const web3 = this.injectedWeb3 || this.web3;
    const [address] = await web3.eth.getAccounts();
    if (!address) throw new DriftError("No signer address found");
    return address;
  }

  /**
   * @throws A {@linkcode NotImplementedError} if no wallet provider is set.
   */
  async getWalletCapabilities<TChainIds extends readonly number[]>({
    address,
    chainIds,
  }: GetWalletCapabilitiesParams<TChainIds> = {}): Promise<
    WalletCapabilities<TChainIds>
  > {
    if (!this.injectedWeb3?.provider) {
      throw new NotImplementedError({
        method: "getWalletCapabilities",
        message: "No injected provider found.",
      });
    }

    return this.injectedWeb3.provider
      .request<"wallet_getCapabilities", Record<HexString, WalletCapabilities>>(
        {
          method: "wallet_getCapabilities",
          params: [
            address || (await this.getSignerAddress()),
            (chainIds?.map((id) => toHexString(id)) || [
              toHexString(await this.getChainId()),
            ]) as HexString[] | undefined,
          ],
        },
      )
      .then((res) => {
        return Object.fromEntries(
          Object.entries(
            res as unknown as Record<HexString, WalletCapabilities>,
          ).map(([key, value]) => [Number(key), value]),
        ) as WalletCapabilities<TChainIds>;
      })
      .catch((e) => {
        throw new DriftError({
          message: "Failed to get wallet capabilities",
          cause: e,
        });
      });
  }

  /**
   * @throws A {@linkcode NotImplementedError} if no wallet provider is set.
   */
  async getCallsStatus<TId extends HexString>(
    batchId: TId,
  ): Promise<WalletCallsStatus<TId>> {
    if (!this.injectedWeb3?.provider) {
      throw new NotImplementedError({
        method: "getCallsStatus",
        message: "No injected provider found.",
      });
    }

    return this.injectedWeb3.provider
      .request<"wallet_getCallsStatus", WalletGetCallsStatusReturn>({
        method: "wallet_getCallsStatus",
        params: [batchId],
      })
      .then((res) => {
        const { chainId, id, receipts, status, ...rest } =
          res as unknown as WalletGetCallsStatusReturn;
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
      .catch((e) => {
        throw new DriftError({
          message: "Failed to get wallet calls status",
          cause: e,
        });
      });
  }

  /**
   * @throws A {@linkcode NotImplementedError} if no wallet provider is set.
   */
  async showCallsStatus(batchId: HexString): Promise<void> {
    if (!this.injectedWeb3?.provider) {
      throw new NotImplementedError({
        method: "showCallsStatus",
        message: "No injected provider found.",
      });
    }

    await this.injectedWeb3?.provider
      .request({
        method: "wallet_showCallsStatus",
        params: [batchId],
      })
      .catch((e) => {
        throw new DriftError({
          message: "Failed to show wallet calls status",
          cause: e,
        });
      });
  }

  /**
   * @throws A {@linkcode NotImplementedError} if no wallet provider is set.
   */
  async sendCalls<const TCalls extends readonly unknown[] = any[]>({
    atomic = true,
    calls,
    chainId,
    from,
    version = "2.0.0",
    ...rest
  }: SendCallsParams<TCalls>): Promise<SendCallsReturn> {
    if (!this.injectedWeb3?.provider) {
      throw new NotImplementedError({
        method: "sendCalls",
        message: "No injected provider found.",
      });
    }

    const [resolvedChainId, resolvedFrom] = await Promise.all([
      chainId ?? (await this.getChainId()),
      from || (await this.getSignerAddress()),
    ]);
    const preparedCalls = calls.map(({ value, capabilities, ...call }) => {
      const { to, data } = prepareCall(call);
      return {
        to,
        data,
        capabilities,
        value: value !== undefined ? toHexString(value) : undefined,
      };
    });

    return this.injectedWeb3.provider
      .request<"wallet_sendCalls">({
        method: "wallet_sendCalls",
        params: [
          {
            atomicRequired: atomic,
            calls: preparedCalls,
            chainId: toHexString(resolvedChainId),
            from: resolvedFrom,
            version,
            ...rest,
          },
        ],
      })
      .catch((e) => {
        throw new DriftError({
          message: "Failed to send wallet calls",
          cause: e,
        });
      }) as Promise<SendCallsReturn>;
  }

  async sendTransaction({
    accessList,
    data,
    from,
    onMined,
    onMinedTimeout,
    to,
    ...rest
  }: SendTransactionParams) {
    const web3 = this.injectedWeb3 || this.web3;
    const resolvedFrom = from || (await this.getSignerAddress());

    const txHash = await new Promise<Hash>((resolve, reject) => {
      web3.eth
        .sendTransaction({
          accessList: accessList as AccessList,
          data,
          from: resolvedFrom,
          to,
          ...rest,
        })
        .on("transactionHash", resolve)
        .on("error", reject);
    });

    if (onMined) {
      this.waitForTransaction({
        hash: txHash,
        timeout: onMinedTimeout,
      }).then(onMined);
    }

    return txHash;
  }

  async deploy<TAbi extends Abi>({
    abi,
    args,
    bytecode,
    from,
    gas,
    gasPrice,
    maxFeePerGas,
    maxPriorityFeePerGas,
    nonce,
    value,
    onMined,
    onMinedTimeout,
    ...rest
  }: DeployParams<TAbi>) {
    const web3 = this.injectedWeb3 || this.web3;
    const contract = new web3.eth.Contract(abi as readonly AbiFragment[]);
    const { params } = prepareParams({
      abi,
      type: "constructor",
      name: undefined,
      kind: "inputs",
      value: args,
    });
    const resolvedFrom = from || (await this.getSignerAddress());

    const txHash = await new Promise<Hash>((resolve, reject) => {
      contract
        .deploy({ arguments: params, data: bytecode })
        .send({
          from: resolvedFrom,
          gas: gas?.toString(),
          gasPrice: gasPrice?.toString(),
          maxFeePerGas: maxFeePerGas?.toString(),
          maxPriorityFeePerGas: maxPriorityFeePerGas?.toString(),
          nonce: nonce?.toString(),
          value: value?.toString(),
          ...rest,
        })
        .on("transactionHash", (hash) => resolve(toHexString(hash)))
        .on("error", reject);
    });

    if (onMined) {
      this.waitForTransaction({
        hash: txHash,
        timeout: onMinedTimeout,
      }).then(onMined);
    }

    return txHash;
  }

  async simulateWrite<
    TAbi extends Abi,
    TFunctionName extends FunctionName<TAbi>,
  >(params: SimulateWriteParams<TAbi, TFunctionName>) {
    return super.simulateWrite({
      ...params,
      from:
        params.from || (await this.getSignerAddress().catch(() => undefined)),
    });
  }

  async write<
    TAbi extends Abi,
    TFunctionName extends FunctionName<TAbi, "nonpayable" | "payable">,
  >({
    abi,
    accessList,
    address,
    args,
    fn,
    from,
    onMined,
    onMinedTimeout,
    ...rest
  }: WriteParams<TAbi, TFunctionName>) {
    const web3 = this.injectedWeb3 || this.web3;
    const { params } = prepareParams({
      abi,
      type: "function",
      name: fn,
      kind: "inputs",
      value: args,
    });
    const { method } = this.#getMethod({ abi, fn, address });
    const resolvedFrom = from || (await this.getSignerAddress());
    const data = method(...params).encodeABI();

    const hash = await new Promise<Hash>((resolve, reject) => {
      web3.eth
        .sendTransaction({
          accessList: accessList as AccessList,
          data,
          from: resolvedFrom,
          to: address,
          ...rest,
        })
        .on("transactionHash", resolve)
        .on("error", reject);
    });

    if (onMined) {
      this.waitForTransaction({
        hash,
        timeout: onMinedTimeout,
      }).then(onMined);
    }

    return hash;
  }

  #getMethod({
    abi,
    fn,
    address,
  }: {
    abi: Abi;
    fn: string;
    address?: Address;
  }) {
    const contract = new this.web3.eth.Contract(
      abi as readonly AbiFragment[],
      address,
    );
    const method = contract.methods[fn];

    if (!method) {
      throw new DriftError(
        `Function ${fn} not found in ABI for contract at address ${address}`,
      );
    }

    return { contract, method };
  }
}

interface WalletGetCallsStatusReturn {
  atomic: boolean;
  capabilities?: WalletCapabilities | undefined;
  chainId: HexString;
  id: string;
  receipts?: {
    status: HexString;
    blockHash: HexString;
    blockNumber: HexString;
    gasUsed: HexString;
    transactionHash: HexString;
  }[];
  status: number;
  version: string;
}

declare module "@gud/drift" {
  interface BaseTypeOverrides {
    HexString: string;
  }

  interface ContractCallOptions {
    /**
     * Unavailable in web3.js.
     */
    blobs?: undefined;
    /**
     * Unavailable in web3.js.
     */
    blobVersionedHashes?: undefined;
    /**
     * Unavailable in web3.js.
     */
    maxFeePerBlobGas?: undefined;
  }

  interface WriteOptions {
    /**
     *
     *
     * **Note**: The web3.js adapter uses an events-based approach for
     * waiting for transactions to be mined, so this option is not used.
     */
    onMinedTimeout?: number;
  }
}
