import type { Abi, Address, Bytes, Hash } from "src/adapter/types/Abi";
import type {
  Adapter,
  ContractParams,
  GetEventsOptions,
  MulticallCalls,
  MulticallOptions,
  MulticallReturn,
  ReadAdapter,
  ReadOptions,
  ReadWriteAdapter,
  WriteOptions,
} from "src/adapter/types/Adapter";
import type { BlockIdentifier } from "src/adapter/types/Block";
import type { EventLog, EventName } from "src/adapter/types/Event";
import type {
  ConstructorArgs,
  DecodedFunctionData,
  FunctionArgs,
  FunctionName,
  FunctionReturn,
  ReadFunctionName,
  WriteFunctionName,
} from "src/adapter/types/Function";
import type { TransactionOptions } from "src/adapter/types/Transaction";
import {
  type Client,
  type ClientOptions,
  createClient,
} from "src/client/Client";
import { ContractCache } from "src/client/contract/cache/ContractCache";
import type {
  EventListenerOptions,
  Unsubscribe,
} from "src/client/utils/createPoller";
import type { Store } from "src/store/Store";
import type {
  DynamicProperty,
  EmptyObject,
  Eval,
  Extended,
  NarrowTo,
  OneOf,
} from "src/utils/types";

/**
 * An interface for interacting with a smart contract through a drift
 * {@linkcode Client}.
 */
export type Contract<
  TAbi extends Abi = Abi,
  TAdapter extends Adapter = Adapter,
  TStore extends Store = Store,
  TClient extends Client<TAdapter, TStore> = Client<TAdapter, TStore>,
> = TAdapter extends ReadWriteAdapter
  ? ReadWriteContract<TAbi, TAdapter, TStore, TClient>
  : ReadContract<TAbi, TAdapter, TStore, TClient>;

export type ContractBaseOptions<TAbi extends Abi = Abi> = Eval<
  ContractParams<TAbi> & {
    /**
     * The earliest block number to use for event queries. If defined,
     * {@linkcode GetEventsOptions.fromBlock} will be overridden when
     * `undefined`, `"earliest"`, or a lower block number in
     * {@linkcode Contract.getEvents}.
     *
     * @example
     * ```ts
     * const contract = createContract({
     *   abi,
     *   address,
     *   client,
     *   epochBlock: 22147561n,
     * });
     *
     * const approvals = await contract.getEvents("Approval"); // <- `fromBlock` set to `this.epochBlock`
     *
     * const transfers = await contract.getEvents("Transfer", {
     *   fromBlock: "earliest", // <- overridden with `this.epochBlock`
     * });
     * ```
     */
    epochBlock?: bigint;
  }
>;

/**
 * Configuration options for creating a {@linkcode Contract}.
 */
export type ContractOptions<
  TAbi extends Abi = Abi,
  TAdapter extends Adapter = Adapter,
  TStore extends Store = Store,
  TClient extends Client<TAdapter, TStore> = Client<TAdapter, TStore>,
> = Eval<
  ContractBaseOptions<TAbi> &
    OneOf<
      | {
          client?: TClient;
        }
      | ClientOptions<TAdapter, TStore>
    >
>;

/**
 * A read-only {@linkcode Contract} instance for fetching data from a smart
 * contract through a drift {@linkcode Client}.
 */
export class ReadContract<
  TAbi extends Abi = Abi,
  TAdapter extends ReadAdapter = ReadAdapter,
  TStore extends Store = Store,
  TClient extends Client<TAdapter, TStore> = Client<TAdapter, TStore>,
> {
  abi: TAbi;
  address: Address;
  client: TClient;
  cache: ContractCache<TAbi, TStore>;
  epochBlock?: bigint;

  constructor({
    abi,
    address,
    epochBlock,
    client,
    ...clientOptions
  }: ContractOptions<TAbi, TAdapter, TStore, TClient>) {
    this.abi = abi;
    this.address = address;
    this.client = (client ?? createClient(clientOptions)) as TClient;
    this.cache = new ContractCache({
      abi,
      address,
      clientCache: this.client.cache,
    });
    this.epochBlock = epochBlock;
  }

  isReadWrite(): this is Contract<TAbi, ReadWriteAdapter> {
    return this.client.isReadWrite();
  }

  extend<T extends Partial<Extended<this>>>(
    props: T & Partial<this> & ThisType<T & this>,
  ): T & this {
    return Object.assign(this, props);
  }

  getBytecode(block?: BlockIdentifier): Promise<Bytes | undefined> {
    return this.client.getBytecode({ address: this.address, block });
  }

  /**
   * Encodes a contract deploy call into calldata.
   */
  encodeDeployData(
    ...[bytecode, args]: ContractEncodeDeployDataArgs<TAbi>
  ): Bytes {
    return this.client.encodeDeployData({
      abi: this.abi,
      bytecode,
      args: args as ConstructorArgs<TAbi>,
    });
  }

  /**
   * Encodes a function call into calldata.
   */
  encodeFunctionData<TFunctionName extends FunctionName<TAbi>>(
    ...[fn, args]: ContractEncodeFunctionDataArgs<TAbi, TFunctionName>
  ) {
    return this.client.encodeFunctionData({
      abi: this.abi,
      fn,
      args: args as FunctionArgs<TAbi, TFunctionName>,
    });
  }

  /**
   * Encodes a function return data for a contract method.
   */
  encodeFunctionReturn<TFunctionName extends FunctionName<TAbi>>(
    fn: TFunctionName,
    value: FunctionReturn<TAbi, TFunctionName>,
  ) {
    return this.client.encodeFunctionReturn({
      abi: this.abi,
      fn,
      value,
    });
  }

  /**
   * Decodes a string of function calldata into it's arguments and function
   * name.
   */
  decodeFunctionData<
    TFunctionName extends FunctionName<TAbi> = FunctionName<TAbi>,
  >(data: Bytes): DecodedFunctionData<TAbi, TFunctionName> {
    return this.client.decodeFunctionData({
      abi: this.abi,
      data,
    });
  }

  /**
   * Decodes a string of function return data into it's return value.
   */
  decodeFunctionReturn<
    TFunctionName extends FunctionName<TAbi> = FunctionName<TAbi>,
  >(fn: TFunctionName, data: Bytes): FunctionReturn<TAbi, TFunctionName> {
    return this.client.decodeFunctionReturn({
      abi: this.abi,
      fn,
      data,
    });
  }

  /**
   * Retrieves specified events from the contract.
   */
  getEvents<TEventName extends EventName<TAbi>>(
    event: TEventName,
    { fromBlock, ...options }: GetEventsOptions<TAbi, TEventName> = {},
  ): Promise<EventLog<TAbi, TEventName>[]> {
    if (
      this.epochBlock &&
      (!fromBlock ||
        fromBlock === "earliest" ||
        (typeof fromBlock === "bigint" && fromBlock < this.epochBlock))
    ) {
      fromBlock = this.epochBlock;
    }
    return this.client.getEvents({
      abi: this.abi,
      address: this.address,
      event,
      fromBlock,
      ...options,
    });
  }

  /**
   * Registers a callback that's invoked with new logs each time the given event
   * is emitted by this contract. Polls the client for events with block numbers
   * later than the last one seen.
   *
   * By default the listener only reports events emitted after it's registered.
   * Pass a `fromBlock` option to also report historical events on the first
   * poll. The contract's {@linkcode epochBlock} is applied the same way as in
   * {@linkcode getEvents}.
   *
   * **Note**: This polls forward from the latest block seen and does not handle
   * chain reorganizations, so events from blocks that are re-mined after a
   * reorg may be missed.
   *
   * @returns A function that stops the listener when called.
   *
   * @example
   * ```ts
   * const unsubscribe = contract.onEvent("Transfer", (events) => {
   *   for (const event of events) console.log(event.args);
   * });
   * ```
   */
  onEvent<TEventName extends EventName<TAbi>>(
    event: TEventName,
    callback: (events: EventLog<TAbi, TEventName>[]) => void,
    {
      filter,
      fromBlock,
      ...options
    }: OnContractEventOptions<TAbi, TEventName> = {},
  ): Unsubscribe {
    if (
      this.epochBlock &&
      (!fromBlock ||
        fromBlock === "earliest" ||
        (typeof fromBlock === "bigint" && fromBlock < this.epochBlock))
    ) {
      fromBlock = this.epochBlock;
    }
    return this.client.onEvent(
      { abi: this.abi, address: this.address, event, filter, fromBlock },
      callback,
      options,
    );
  }

  /**
   * Reads a specified function from the contract.
   */
  read<TFunctionName extends ReadFunctionName<TAbi>>(
    ...[fn, args, options]: ContractReadArgs<TAbi, TFunctionName>
  ): Promise<FunctionReturn<TAbi, TFunctionName>> {
    return this.client.read({
      abi: this.abi,
      address: this.address,
      fn,
      args: args as FunctionArgs<TAbi, TFunctionName>,
      ...options,
    });
  }

  /**
   * Simulates a write operation on a specified function of the contract.
   */
  simulateWrite<TFunctionName extends WriteFunctionName<TAbi>>(
    ...[fn, args, options]: ContractSimulateWriteArgs<TAbi, TFunctionName>
  ): Promise<FunctionReturn<TAbi, TFunctionName>> {
    return this.client.simulateWrite({
      abi: this.abi,
      address: this.address,
      fn,
      args: args as FunctionArgs<TAbi, TFunctionName>,
      ...options,
    });
  }

  /**
   * Uses Multicall3 to read multiple functions from the contract in a
   * single request.
   */
  async multicall<
    TCalls extends { fn: FunctionName<TAbi> }[],
    TAllowFailure extends boolean = true,
  >({
    calls,
    ...options
  }: ContractMulticallParams<TAbi, TCalls, TAllowFailure>): Promise<
    ContractMulticallReturn<TAbi, TCalls, TAllowFailure>
  > {
    return this.client.multicall({
      calls: calls.map(
        (call) =>
          ({
            abi: this.abi,
            address: this.address,
            ...call,
          }) as MulticallCalls[number],
      ),
      ...options,
    }) as Promise<ContractMulticallReturn<TAbi, TCalls, TAllowFailure>>;
  }
}

/**
 * A read-write {@linkcode Contract} with access to a signer for fetching data
 * and submitting transactions through a drift {@linkcode Client}.
 */
export class ReadWriteContract<
  TAbi extends Abi = Abi,
  TAdapter extends ReadWriteAdapter = ReadWriteAdapter,
  TStore extends Store = Store,
  TClient extends Client<TAdapter, TStore> = Client<TAdapter, TStore>,
> extends ReadContract<TAbi, TAdapter, TStore, TClient> {
  /**
   * Get the address of the signer for this contract.
   */
  getSignerAddress(): Promise<Address> {
    return this.client.getSignerAddress();
  }

  /**
   * @returns The transaction hash of the submitted transaction.
   */
  write<TFunctionName extends WriteFunctionName<TAbi>>(
    ...[fn, args, options]: ContractWriteArgs<TAbi, TFunctionName>
  ): Promise<Hash> {
    return this.client.write({
      abi: this.abi,
      address: this.address,
      fn,
      args: args as FunctionArgs<TAbi, TFunctionName>,
      ...options,
    });
  }
}

/**
 * Creates a new {@linkcode Contract} instance for interacting with a smart
 * contract through a drift {@linkcode Client}.
 *
 * @param config - The configuration to use for the contract.
 * @returns
 */
export function createContract<
  TAbi extends Abi,
  TAdapter extends Adapter,
  TStore extends Store,
  TClient extends Client<TAdapter, TStore>,
>({
  abi,
  address,
  epochBlock,
  client,
  ...clientOptions
}: ContractOptions<TAbi, TAdapter, TStore, TClient>): Contract<
  TAbi,
  TClient["adapter"],
  TClient["cache"]["store"],
  TClient
> {
  client = (client || createClient(clientOptions)) as TClient;

  if (client.isReadWrite()) {
    return new ReadWriteContract({
      abi,
      address,
      client,
      epochBlock,
    }) as Contract<TAbi, TAdapter, TStore, TClient>;
  }

  return new ReadContract({ abi, address, client, epochBlock }) as Contract<
    TAbi,
    TAdapter,
    TStore,
    TClient
  >;
}

// Parameter types //

/**
 * Options for a {@linkcode ReadContract.onEvent} listener. The same as
 * {@linkcode GetEventsOptions} without `toBlock` (managed by the listener), plus
 * {@linkcode EventListenerOptions}.
 */
export type OnContractEventOptions<
  TAbi extends Abi = Abi,
  TEventName extends EventName<TAbi> = EventName<TAbi>,
> = Omit<GetEventsOptions<TAbi, TEventName>, "toBlock"> & EventListenerOptions;

export type ContractEncodeDeployDataArgs<TAbi extends Abi = Abi> =
  EmptyObject extends ConstructorArgs<TAbi>
    ? [bytecode: Bytes, args?: ConstructorArgs<TAbi>]
    : [bytecode: Bytes, args: ConstructorArgs<TAbi>];

export type ContractEncodeFunctionDataArgs<
  TAbi extends Abi = Abi,
  TFunctionName extends FunctionName<TAbi> = FunctionName<TAbi>,
> = EmptyObject extends FunctionArgs<TAbi, TFunctionName>
  ? [functionName: TFunctionName, args?: FunctionArgs<TAbi, TFunctionName>]
  : [functionName: TFunctionName, args: FunctionArgs<TAbi, TFunctionName>];

export type ContractReadArgs<
  TAbi extends Abi = Abi,
  TFunctionName extends ReadFunctionName<TAbi> = ReadFunctionName<TAbi>,
> = EmptyObject extends FunctionArgs<TAbi, TFunctionName>
  ? [
      functionName: TFunctionName,
      args?: FunctionArgs<TAbi, TFunctionName>,
      options?: ReadOptions,
    ]
  : [
      functionName: TFunctionName,
      args: FunctionArgs<TAbi, TFunctionName>,
      options?: ReadOptions,
    ];

export type ContractSimulateWriteArgs<
  TAbi extends Abi = Abi,
  TFunctionName extends WriteFunctionName<TAbi> = WriteFunctionName<TAbi>,
> = EmptyObject extends FunctionArgs<TAbi, TFunctionName>
  ? [
      functionName: TFunctionName,
      args?: FunctionArgs<TAbi, TFunctionName>,
      options?: TransactionOptions,
    ]
  : [
      functionName: TFunctionName,
      args: FunctionArgs<TAbi, TFunctionName>,
      options?: TransactionOptions,
    ];

export type ContractWriteArgs<
  TAbi extends Abi = Abi,
  TFunctionName extends WriteFunctionName<TAbi> = WriteFunctionName<TAbi>,
> = EmptyObject extends FunctionArgs<TAbi, TFunctionName>
  ? [
      functionName: TFunctionName,
      args?: FunctionArgs<TAbi, TFunctionName>,
      options?: WriteOptions,
    ]
  : [
      functionName: TFunctionName,
      args: FunctionArgs<TAbi, TFunctionName>,
      options?: WriteOptions,
    ];

export type ContractMulticallParams<
  TAbi extends Abi = Abi,
  TCalls extends { fn: FunctionName<TAbi> }[] = { fn: FunctionName<TAbi> }[],
  TAllowFailure extends boolean = boolean,
> = {
  calls: {
    [K in keyof TCalls]: NarrowTo<
      {
        fn: TCalls[K]["fn"];
      } & DynamicProperty<"args", FunctionArgs<TAbi, TCalls[K]["fn"]>>,
      TCalls[K]
    >;
  };
} & MulticallOptions<TAllowFailure>;

export type ContractMulticallReturn<
  TAbi extends Abi = Abi,
  TCalls extends { fn: FunctionName<TAbi> }[] = { fn: FunctionName<TAbi> }[],
  TAllowFailure extends boolean = boolean,
> = MulticallReturn<
  {
    [K in keyof TCalls]: ContractParams<TAbi> & TCalls[K];
  },
  TAllowFailure
>;
