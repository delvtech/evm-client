import {
  DefaultAdapter,
  type DefaultAdapterOptions,
} from "src/adapter/DefaultAdapter";
import type { Abi, Address } from "src/adapter/types/Abi";
import type {
  Adapter,
  GetBlockReturn,
  GetEventsParams,
  RangeBlock,
  ReadWriteAdapter,
} from "src/adapter/types/Adapter";
import type { Block, BlockIdentifier } from "src/adapter/types/Block";
import type { EventLog, EventName } from "src/adapter/types/Event";
import { getMulticallAddress } from "src/adapter/utils/getMulticallAddress";
import { MulticallQueue } from "src/client/batching/MulticallQueue";
import { ClientCache } from "src/client/cache/ClientCache";
import { BlockNotFoundError } from "src/client/errors";
import type { HookRegistry } from "src/client/hooks/HookRegistry";
import {
  type MethodHooks,
  MethodInterceptor,
} from "src/client/hooks/MethodInterceptor";
import { cachedMulticall } from "src/client/utils/cachedMulticall";
import {
  createPoller,
  DEFAULT_POLLING_INTERVAL,
  type EventListenerOptions,
  type Unsubscribe,
} from "src/client/utils/createPoller";
import { DriftError } from "src/error/DriftError";
import { LruStore, type LruStoreOptions } from "src/store/LruStore";
import type { Store } from "src/store/Store";
import { getOrSet } from "src/store/utils/getOrSet";
import type { Eval, Extended, OneOf } from "src/utils/types";

/**
 * A client for interacting with a network through an {@linkcode Adapter} with
 * {@link ClientCache caching} and {@link HookRegistry hooks}.
 */
export type Client<
  TAdapter extends Adapter = Adapter,
  TStore extends Store = Store,
  TExtension extends object = {},
> = {
  /**
   * The {@linkcode Adapter} used by the client for network interactions.
   */
  adapter: TAdapter;

  /**
   * A cache for storing responses from the adapter using the provided
   * {@linkcode Store}.
   */
  cache: ClientCache<TStore>;

  /**
   * Hooks for intercepting and modifying method calls or responses on the
   * client.
   */
  hooks: HookRegistry<MethodHooks<TAdapter & TExtension>> &
    // Intersect with default Adapter hooks to ensure autocomplete works in
    // generic contexts where TAdapter isn't resolved to a specific type.
    HookRegistry<MethodHooks<Adapter>>;

  /**
   * Returns `true` if the client can send transactions.
   */
  isReadWrite(): this is Client<ReadWriteAdapter, TStore, TExtension>;

  /**
   * Extends the client with additional properties.
   */
  extend<T extends object>(
    props: Extended<
      // Using distributive conditional types here ensures that T is inferred as
      // all properties not present by default on the Client, which when
      // intersected with Client<TAdapter, TStore, TExtension> results in the
      // full expected return type. This is necessary to correctly infer the
      // required props and return type on a dynamic interface.
      T extends T ? Omit<T, keyof Client | keyof TExtension> : T
    > &
      Partial<Client & TExtension> &
      ThisType<Client<TAdapter, TStore, TExtension & T>>,
  ): Client<TAdapter, TStore, Eval<TExtension & T>>;

  getBlock<
    T extends BlockIdentifier | undefined = undefined,
    TOptions extends GetBlockOptions = {},
  >(
    block?: T,
    options?: Eval<GetBlockOptions & TOptions>,
  ): Promise<GetBlockWithOptionsReturn<T, TOptions>>;

  /**
   * Registers a callback that's invoked with the latest block number as new
   * blocks are created. Polls the adapter on an interval and fires once per
   * poll, so intermediate block numbers may be skipped if several blocks are
   * created between polls.
   *
   * @returns A function that stops the listener when called.
   *
   * @example
   * ```ts
   * const unsubscribe = client.onBlock((blockNumber) => {
   *   console.log("New block:", blockNumber);
   * });
   * // Later, stop listening:
   * unsubscribe();
   * ```
   */
  onBlock(
    callback: (blockNumber: bigint) => void,
    options?: EventListenerOptions,
  ): Unsubscribe;

  /**
   * Registers a callback that's invoked with new logs each time matching
   * contract events are emitted. Polls the adapter for events with block numbers
   * later than the last one seen.
   *
   * By default the listener only reports events emitted after it's registered.
   * Pass a {@linkcode GetEventsParams.fromBlock fromBlock} to also report
   * historical events on the first poll.
   *
   * **Note**: This polls forward from the latest block seen and does not handle
   * chain reorganizations, so events from blocks that are re-mined after a
   * reorg may be missed.
   *
   * @returns A function that stops the listener when called.
   *
   * @example
   * ```ts
   * const unsubscribe = client.onEvent(
   *   { abi: erc20.abi, address, event: "Transfer" },
   *   (events) => {
   *     for (const event of events) console.log(event.args);
   *   },
   * );
   * ```
   */
  onEvent<TAbi extends Abi, TEventName extends EventName<TAbi>>(
    params: OnEventParams<TAbi, TEventName>,
    callback: (events: EventLog<TAbi, TEventName>[]) => void,
    options?: EventListenerOptions,
  ): Unsubscribe;

  /**
   * Registers a callback that's invoked with the new signer address whenever the
   * client's signer changes. Polls the adapter on an interval.
   *
   * **Note**: Requires a read-write adapter with a signer.
   *
   * @returns A function that stops the listener when called.
   */
  onSignerChange(
    callback: (address: Address) => void,
    options?: EventListenerOptions,
  ): Unsubscribe;
} & TAdapter &
  TExtension;

/**
 * Params for registering a {@linkcode Client.onEvent} listener. The same as
 * {@linkcode GetEventsParams} without `toBlock`, which the listener manages
 * internally.
 */
export type OnEventParams<
  TAbi extends Abi = Abi,
  TEventName extends EventName<TAbi> = EventName<TAbi>,
> = Omit<GetEventsParams<TAbi, TEventName>, "toBlock">;

export interface GetBlockOptions {
  /**
   * Whether to throw a {@linkcode BlockNotFoundError} if the block isn't found.
   * Setting this to true will remove `undefined` from the return type.
   * @default false
   */
  throws?: boolean;
}

/**
 * The awaited return type of a {@linkcode Client.getBlock} call considering the
 * provided {@linkcode BlockIdentifier} and {@linkcode GetBlockOptions}.
 */
export type GetBlockWithOptionsReturn<
  T extends BlockIdentifier | undefined = undefined,
  TOptions extends GetBlockOptions = {},
> = TOptions extends { throws: true } ? Block<T> : GetBlockReturn<T>;

/**
 * Configuration options for creating a {@linkcode Client}.
 */
export type ClientOptions<
  TAdapter extends Adapter = Adapter,
  TStore extends Store = Store,
> = Eval<
  OneOf<
    | {
        /**
         * The adapter to use for network interactions. The resulting client will
         * extend the adapter's prototype, inheriting all of its methods and
         * copying all of its properties.
         */
        adapter?: TAdapter;
      }
    | DefaultAdapterOptions
  > & {
    // Accept LRU config if LRU can be assigned to TStore
    store?: LruStore extends TStore ? TStore | LruStoreOptions : TStore;

    /**
     * The chain ID to use for the client. Fetched from the adapter by default.
     */
    chainId?: number;

    /**
     * Whether to enable automatic request batching for calls and reads.
     * @default true
     */
    batch?: boolean;

    /**
     * The maximum batch size for automatic request batching.
     */
    maxBatchSize?: number;
  }
>;

/**
 * Creates a new {@linkcode Client} instance that extends the provided adapter
 * or the default {@linkcode DefaultAdapter}.
 *
 * @param config - The configuration to use for the client.
 */
export function createClient<
  TAdapter extends Adapter = DefaultAdapter,
  TStore extends Store = LruStore,
>(options: ClientOptions<TAdapter, TStore> = {}): Client<TAdapter, TStore> {
  let {
    adapter: maybeAdapter,
    store: storeOrOptions,
    chainId,
    batch = true,
    maxBatchSize,
    ...adapterOptions
  } = options;

  // Handle adapter options.
  const adapter = (maybeAdapter ||
    new DefaultAdapter(adapterOptions)) as TAdapter;

  // Handle cache options.
  const store = (
    storeOrOptions && "clear" in storeOrOptions
      ? storeOrOptions
      : new LruStore(storeOrOptions)
  ) as TStore;

  // Create a getter for the chain ID to ensure it's only fetched once.
  async function getChainId() {
    chainId ??= await adapter.getChainId();
    return chainId;
  }

  // Create a cache for storing responses from the adapter.
  const cache = new ClientCache({ store, namespace: getChainId });

  // Create a multicall queue for automatic request aggregation.
  const multicallQueue = batch
    ? new MulticallQueue({ adapter, cache, getChainId, maxBatchSize })
    : undefined;

  // Create a method interceptor for hooks.
  const interceptor = new MethodInterceptor<TAdapter>();

  // Extend the adapter prototype to copy over its methods without calling its
  // constructor. This allows the client to be used as a drop-in replacement for
  // the adapter.

  function Client() {}
  Object.defineProperty(Client, "name", {
    value: `Client<${adapter.constructor.name}>`,
  });

  const adapterPrototype = Object.getPrototypeOf(adapter);
  Client.prototype = Object.create(adapterPrototype);
  Object.defineProperty(Client.prototype, "constructor", {
    value: Client,
  });
  Object.defineProperty(Client.prototype, Symbol.toStringTag, {
    value: Client.name,
    writable: true,
    configurable: true,
  });

  const client: Client<TAdapter, TStore> = Object.create(Client.prototype);

  // Copy over adapter properties and add client logic.
  Object.assign(client, {
    ...adapter,
    adapter,
    hooks: interceptor.hooks,
    cache,

    isReadWrite(): this is Client<ReadWriteAdapter, TStore> {
      return typeof this.adapter.write === "function";
    },

    extend(props) {
      return Object.assign(this, props) as any;
    },

    // Cached methods //

    getChainId,

    async getBlock(blockId?: BlockIdentifier, options?: GetBlockOptions) {
      const block = await getOrSet({
        store: this.cache.store,
        key: this.cache.blockKey(blockId),
        fn: () => this.adapter.getBlock(blockId),
      });
      if (!block && options?.throws) {
        throw new BlockNotFoundError(blockId);
      }
      return block;
    },

    getBalance(params) {
      return getOrSet({
        store: this.cache.store,
        key: this.cache.balanceKey(params),
        fn: () => this.adapter.getBalance(params),
      });
    },

    getBytecode(params) {
      return getOrSet({
        store: this.cache.store,
        key: this.cache.bytecodeKey(params),
        fn: () => this.adapter.getBytecode(params),
      });
    },

    getTransaction(params) {
      return getOrSet({
        store: this.cache.store,
        key: this.cache.transactionKey(params),
        fn: () => this.adapter.getTransaction(params),
      });
    },

    waitForTransaction(params) {
      return getOrSet({
        store: this.cache.store,
        key: this.cache.transactionReceiptKey(params),
        fn: () => this.adapter.waitForTransaction(params),
      });
    },

    getEvents({ fromBlock = "earliest", toBlock = "latest", ...restParams }) {
      const params = { fromBlock, toBlock, ...restParams };
      return getOrSet({
        store: this.cache.store,
        key: this.cache.eventsKey(params),
        fn: async () => this.adapter.getEvents(params),
      });
    },

    call(params) {
      return (
        multicallQueue?.submit(params) ??
        getOrSet({
          store: this.cache.store,
          key: this.cache.callKey(params),
          fn: () => this.adapter.call(params),
        })
      );
    },

    read(params) {
      return (
        multicallQueue?.submit(params) ??
        getOrSet({
          store: this.cache.store,
          key: this.cache.readKey(params),
          fn: () => this.adapter.read(params),
        })
      );
    },

    async multicall({ multicallAddress, ...restParams }) {
      if (!multicallAddress) {
        const chainId = await this.getChainId();
        multicallAddress = getMulticallAddress(chainId);
      }
      return cachedMulticall({
        adapter: this.adapter,
        cache: this.cache,
        params: { multicallAddress, ...restParams },
      });
    },

    // Event listeners //

    onBlock(callback, options) {
      let lastBlock: bigint | undefined;
      let stopped = false;
      const stop = createPoller({
        pollingInterval: resolvePollingInterval(this.adapter, options),
        onError: options?.onError,
        poll: async () => {
          const blockNumber = await this.adapter.getBlockNumber();
          // Don't fire after unsubscribing, even mid-poll.
          if (stopped) return;
          // Establish a baseline on the first poll without firing, then fire
          // with the latest block number whenever the chain advances. Fires once
          // per poll, so intermediate block numbers may be skipped if several
          // blocks are created between polls.
          if (lastBlock === undefined || blockNumber > lastBlock) {
            const isFirstPoll = lastBlock === undefined;
            lastBlock = blockNumber;
            if (!isFirstPoll) {
              callback(blockNumber);
            }
          }
        },
      });
      return () => {
        stopped = true;
        stop();
      };
    },

    onEvent({ fromBlock, ...params }, callback, options) {
      // Exclusive lower bound of the next block range to fetch, resolved lazily
      // on the first poll from the requested `fromBlock` or the current block.
      let lastBlock: bigint | undefined;
      let stopped = false;
      const stop = createPoller({
        pollingInterval: resolvePollingInterval(this.adapter, options),
        onError: options?.onError,
        poll: async () => {
          const currentBlock = await this.adapter.getBlockNumber();
          if (lastBlock === undefined) {
            lastBlock = startBlockBefore(fromBlock, currentBlock);
          }
          if (currentBlock <= lastBlock) return;
          const events = await this.adapter.getEvents({
            ...params,
            fromBlock: lastBlock + 1n,
            toBlock: currentBlock,
          });
          // Don't fire after unsubscribing, even mid-poll.
          if (stopped) return;
          lastBlock = currentBlock;
          if (events.length) {
            callback(events);
          }
        },
      });
      return () => {
        stopped = true;
        stop();
      };
    },

    onSignerChange(callback, options) {
      const adapter = this.adapter as Partial<ReadWriteAdapter>;
      if (typeof adapter.getSignerAddress !== "function") {
        throw new DriftError(
          "`onSignerChange` requires a read-write adapter with a signer.",
        );
      }
      let lastSigner: Address | undefined;
      let initialized = false;
      let stopped = false;
      const stop = createPoller({
        pollingInterval: resolvePollingInterval(this.adapter, options),
        onError: options?.onError,
        poll: async () => {
          const signer = await adapter.getSignerAddress!();
          // Don't fire after unsubscribing, even mid-poll.
          if (stopped) return;
          // Establish a baseline on the first poll without firing.
          if (!initialized) {
            initialized = true;
            lastSigner = signer;
            return;
          }
          if (signer !== lastSigner) {
            lastSigner = signer;
            callback(signer);
          }
        },
      });
      return () => {
        stopped = true;
        stop();
      };
    },
  } satisfies Client<TAdapter, TStore>);

  return interceptor.createProxy(client);
}

/**
 * Resolves the polling interval for an event listener from the listener options,
 * falling back to the adapter's `pollingInterval` or
 * {@linkcode DEFAULT_POLLING_INTERVAL}.
 */
function resolvePollingInterval(
  adapter: Adapter,
  options?: EventListenerOptions,
): number {
  return (
    options?.pollingInterval ??
    (adapter as { pollingInterval?: number }).pollingInterval ??
    DEFAULT_POLLING_INTERVAL
  );
}

/**
 * Resolves the exclusive lower bound for an {@linkcode Client.onEvent} listener,
 * i.e. the block _before_ the first block it should fetch events from.
 */
function startBlockBefore(
  fromBlock: RangeBlock | undefined,
  currentBlock: bigint,
): bigint {
  // A specific block: fetch from it inclusively.
  if (typeof fromBlock === "bigint") return fromBlock - 1n;
  // Genesis: fetch from block 0 inclusively.
  if (fromBlock === "earliest") return -1n;
  // Otherwise (undefined, "latest", or other tags): only future events.
  return currentBlock;
}
