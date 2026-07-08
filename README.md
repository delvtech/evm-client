# Drift

[![NPM Version](https://img.shields.io/npm/v/%40gud%2Fdrift?color=cb3837)](https://npmjs.com/package/@gud/drift)
[![License:Apache-2.0](https://img.shields.io/badge/Apache%202.0-23454d?logo=apache)](./LICENSE)
[![GitHub](https://img.shields.io/badge/ryangoree%2Fdrift-151b23?logo=github)](https://github.com/ryangoree/drift)

**Effortless Ethereum Development Across Web3 Libraries**

Write cached Ethereum protocol interactions once with Drift and run them
anywhere. Seamlessly support multiple web3 libraries like
[viem](https://viem.sh), [web3.js](https://web3js.org), and
[ethers](https://ethers.org)—without getting locked into a single provider or
rewriting code.

With built-in caching, type-safe contract APIs, and easy-to-use testing mocks,
Drift lets you build efficient and reliable applications without worrying about
call optimizations or juggling countless hooks. Focus on what matters: creating
great features and user experiences.

## Why Drift? <!-- omit from toc -->

Building on Ethereum often means dealing with:

- **Optimizing Network Calls:** Manually caching calls and optimizing queries to
  minimize RPC requests slows down development.
- **Managing Multiple Hooks:** Each contract call often needs its own hook and
  query key to prevent redundant network requests.
- **Complex Testing:** Setting up mocks for contract interactions can be
  cumbersome and error-prone.
- **Hard Dependency on a Specific Web3 Library:** There are several competing
  options, like viem, web3.js, ethers.js. Tying your business logic to a
  specific one creates vendor lock-in and makes it harder to switch down the
  road.

## Drift Solves These Problems <!-- omit from toc -->

- ⚡ **Optimized Performance:** Automatically reduces redundant RPC calls with
  built-in caching. No need to manage hooks or query keys for each call.
- 🔒 **Type Safety:** Drift's type-checked APIs help catch errors at compile
  time.
- 🧪 **Testing Made Easy:** Built-in mocks simplify testing your contract
  interactions. Drift's testing mocks are also type-safe, ensuring your tests
  are always in sync with your contracts.
- 🌐 **Multi-Library Support:** Drift provides a unified interface compatible
  with multiple web3 libraries. Write your contract logic once and use it across
  different providers.
- 🔄 **Extensibility:** Designed to grow with your project's needs, Drift allows
  you to easily extend support to new web3 libraries by creating small adapter
  packages.

## Table of Contents <!-- omit from toc -->

- [Installation](#installation)
- [Start Drifting](#start-drifting)
  - [1. Create a Drift client](#1-create-a-drift-client)
  - [2. Interact with your Contracts](#2-interact-with-your-contracts)
    - [Read Operations with Caching](#read-operations-with-caching)
    - [Write Operations](#write-operations)
    - [Deployments](#deployments)
    - [Contract Instances](#contract-instances)
- [Example: Building Vault Clients](#example-building-vault-clients)
  - [1. Define vault clients](#1-define-vault-clients)
  - [2. Use the clients in your application](#2-use-the-clients-in-your-application)
    - [Benefits of This Architecture](#benefits-of-this-architecture)
  - [3. Test Your Clients with Drift's Built-in Mocks](#3-test-your-clients-with-drifts-built-in-mocks)
    - [Example: Testing Client Methods with Multiple RPC Calls](#example-testing-client-methods-with-multiple-rpc-calls)
    - [Benefits](#benefits)
- [Simplifying React Hook Management](#simplifying-react-hook-management)
  - [The Problem Without Drift](#the-problem-without-drift)
  - [How Drift Helps](#how-drift-helps)
    - [Example Using React Query](#example-using-react-query)
- [Caching in Action](#caching-in-action)
  - [Cache Invalidation](#cache-invalidation)
  - [Preloading Cache Data](#preloading-cache-data)
  - [Direct Access to Cached Data](#direct-access-to-cached-data)
- [Extending Drift for Your Needs](#extending-drift-for-your-needs)
  - [Extension Points](#extension-points)
    - [Adapters](#adapters)
    - [Stores](#stores)
  - [Hooks](#hooks)
- [Contributing](#contributing)
- [License](#license)

## Installation

Install Drift:

```sh
npm install @gud/drift
```

**Optional:** To use Drift with a specific web3 library, install the
corresponding adapter:

```sh
# Install one (optional)
npm install @gud/drift-viem
npm install @gud/drift-web3
npm install @gud/drift-ethers
npm install @gud/drift-ethers-v5
```

> [!TIP]
>
> Drift can be used without an adapter, however adapters reuse clients from
> their corresponding web3 library, which can be useful for sharing connection
> settings, signers, and other configurations.

## Start Drifting

### 1. Create a Drift client

```ts
import { createDrift } from "@gud/drift";

const drift = createDrift({
  rpcUrl: "[YOUR_RPC_URL]",
});
```

**Viem adapter example:**

```ts
import { createDrift } from "@gud/drift";
import { viemAdapter } from "@gud/drift-viem";
import { createPublicClient, createWalletClient, http } from "viem";

const publicClient = createPublicClient({
  transport: http(),
});

// optionally create a wallet client
const walletClient = createWalletClient({
  transport: http(),
});

const drift = createDrift({
  adapter: viemAdapter({ publicClient, walletClient }),
});
```

### 2. Interact with your Contracts

#### Read Operations with Caching

```ts
import { VaultAbi } from "./abis/VaultAbi";

// No need to wrap in separate hooks; Drift handles caching internally
const balance = await drift.read({
  abi: VaultAbi,
  address: "0xYourVaultAddress",
  fn: "balanceOf",
  args: {
    // Named type-safe arguments improve readability
    // and discoverability through IDE autocompletion
    account: "0xUserAddress",
  },
});
```

#### Write Operations

If Drift was initialized with a signer, you can perform write operations:

```ts
const txHash = await drift.write({
  abi: VaultAbi,
  address: "0xYourVaultAddress",
  fn: "deposit",
  args: {
    amount: BigInt(100e18),
    receiver: "0xReceiverAddress",
  },

  // Optionally wait for the transaction to be mined and invalidate cache
  onMined: () => {
    drift.cache.invalidateRead({
      abi: VaultAbi,
      address: "0xYourVaultAddress",
      fn: "balanceOf",
      args: {
        account: "0xReceiverAddress",
      },
    });
  },
});
```

#### Deployments

```ts
const txHash = await drift.deploy({
  abi: ERC20.abi,
  bytecode: ERC20.bytecode,
  args: {
    decimals_: 18,
    initialSupply: 100_000_000n * 10n ** 18n, // 100M
  },
});

// Wait for the receipt to get the contract address
const receipt = await drift.waitForTransaction({ hash: txHash });

if (receipt?.status === "success" && receipt.contractAddress) {
  const totalSupply = await drift.read({
    abi: ERC20.abi,
    address: receipt.contractAddress,
    fn: "totalSupply",
  });
  // => 100000000000000000000000000n
}
```

#### Contract Instances

Create contract instances to write your options once and get a streamlined,
type-safe API to re-use across your application.

```ts
const vault = drift.contract({
  abi: VaultAbi,
  address: "0xYourVaultAddress",
  // ...other options
});

const balance = await vault.read("balanceOf", { account });

const txHash = await vault.write(
  "deposit",
  {
    amount: BigInt(100e18),
    receiver: "0xReceiverAddress",
  },
  {
    onMined: () => {
      vault.cache.invalidateRead("balanceOf", { account: "0xReceiverAddress" });
    },
  },
);
```

## Example: Building Vault Clients

Let's build a simple library agnostic SDK with `ReadVault` and `ReadWriteVault`
clients using Drift.

### 1. Define vault clients

Define read and read-write clients that wrap Drift's `ReadContract` and
`ReadWriteContract` abstractions.

```ts
// foobar-sdk/src/VaultClient.ts
import {
  type Address,
  type Drift,
  type EventLog,
  type Hash,
  type ReadContract,
  type ReadWriteAdapter,
  type ReadWriteContract,
  createDrift,
} from "@gud/drift";
import { vaultAbi } from "./abis/vaultAbi";

type VaultAbi = typeof vaultAbi;

/** A read-only Vault client */
export class ReadVault {
  contract: ReadContract<VaultAbi>;

  constructor(address: Address, drift: Drift = createDrift()) {
    this.contract = drift.contract({
      abi: vaultAbi,
      address,
    });
  }

  // Make read calls with internal caching
  getBalance(account: Address) {
    return this.contract.read("balanceOf", { account });
  }
  convertToAssets(shares: bigint) {
    return this.contract.read("convertToAssets", { shares });
  }
  async getAssetValue(account: Address) {
    const shares = await this.getBalance(account);
    return this.convertToAssets(shares);
  }

  // Fetch events with internal caching
  getDeposits(account?: Address) {
    return this.contract.getEvents("Deposit", {
      filter: {
        sender: account,
      },
    });
  }
}

/** A read-write Vault client that can sign transactions */
export class ReadWriteVault extends ReadVault {
  declare contract: ReadWriteContract<VaultAbi>;

  constructor(
    address: Address,
    drift: Drift<ReadWriteAdapter> = createDrift(),
  ) {
    super(address, drift);
  }

  // Make a deposit
  deposit(amount: bigint, account: Address) {
    return this.contract.write(
      "deposit",
      {
        assets: amount,
        receiver: account,
      },
      {
        // Optionally wait for the transaction to be mined and invalidate cache
        onMined: (receipt) => {
          if (receipt?.status === "success") {
            this.contract.cache.clearReads();
          }
        },
      },
    );
  }
}
```

### 2. Use the clients in your application

Using an adapter, you can integrate Drift with your chosen web3 library. Here's
an example using `viem`:

```ts
import { createDrift } from "@gud/drift";
import { viemAdapter } from "@gud/drift-viem";
import { createPublicClient, http } from "viem";
import { ReadVault } from "@foobar/sdk";

const publicClient = createPublicClient({
  transport: http(),
  // ...other options
});

const drift = createDrift({
  adapter: viemAdapter({ publicClient }),
});

// Instantiate the ReadVault client
const readVault = new ReadVault("0xYourVaultAddress", drift);

// Fetch user balance
const userBalance = await readVault.getBalance("0xUserAddress");

// Get the asset value of the user; the balance will be fetched from the cache
const userAssetValue = await readVault.getAssetValue("0xUserAddress");
```

#### Benefits of This Architecture

- **Reusability:** Write your business logic once and reuse it across different
  environments. Easily extend support to new web3 libraries by creating small
  adapter packages.
- **Simplicity:** Your application code stays clean and focused on business
  logic rather than on optimizing network calls or managing cache keys.

### 3. Test Your Clients with Drift's Built-in Mocks

Testing smart contract interactions can be complex and time-consuming. Drift
simplifies this process by providing built-in mocks that allow you to stub
responses and focus on testing your application logic.

> [!IMPORTANT]
>
> Drift's testing mocks have a peer dependency on
> [Sinon.JS](https://sinonjs.org/releases/v17/). Make sure to install it before
> using the mocks.
>
> ```sh
> npm install --save-dev sinon @types/sinon
> ```

#### Example: Testing Client Methods with Multiple RPC Calls

In our `ReadVault` client, the `getAssetValue` method gets the total asset value
for an account by fetching their vault balance and converting it to assets.
Under the hood, this method makes multiple RPC requests.

Here's how you can use Drift's mocks to stub contract calls and test your
method:

```ts
import assert from "node:assert";
import test from "node:test";
import { createMockDrift, randomAddress } from "@gud/drift/testing";
import { vaultAbi } from "./abis/VaultAbi";
import { ReadVault } from "./VaultClient";

test("getAssetValue returns account balances converted to assets", async () => {
  // Set up mocks
  const address = randomAddress();
  const account = randomAddress();
  const mockDrift = createMockDrift();
  const mockContract = mockDrift.contract({ abi: vaultAbi, address });

  // Stub the vault's return values using `on*` methods
  mockContract.onRead("balanceOf", { account }).resolves(
    // Return 100 shares for the account
    BigInt(100e18),
  );
  mockContract.onRead("convertToAssets").callsFake(
    // Simulate the conversion of shares to assets
    async (params) => (params.args.shares * BigInt(1.5e18)) / BigInt(1e18),
  );

  // Create your client with the mocked Drift instance
  const readVault = new ReadVault(address, mockDrift);

  // Call the method you want to test
  const accountAssetValue = await readVault.getAssetValue(account);

  // Assert the expected result
  assert.strictEqual(accountAssetValue, BigInt(150e18));
});
```

#### Benefits

- **No Network Calls:** Tests run faster and more reliably without actual
  network interactions.
- **Focus on Logic:** Concentrate on testing your application's business logic.
- **Easy Setup:** Minimal configuration required to get started with testing.
  You can even start building and testing your clients before the contracts are
  deployed.

## Simplifying React Hook Management

### The Problem Without Drift

In most setups, you might rely on data-fetching libraries like React Query.
However, to prevent redundant network requests, each contract call would need:

- Its own hook (e.g., `useBalanceOf`, `useTokenSymbol`).
- Unique query keys for caching.

Composing multiple calls becomes cumbersome, as you have to manage each hook's
result separately.

### How Drift Helps

Drift's internal caching means you don't need to wrap every contract call in a
separate hook. You can perform multiple contract interactions within a single
function or hook without worrying about redundant requests from overlapping
queries.

#### Example Using React Query

```ts
import { useQuery } from "@tanstack/react-query";
import { ReadVault } from "sdk-core";

function useVaultData(readVault: ReadVault, userAddress: string) {
  return useQuery(["vaultData", userAddress], async () => {
    // Perform multiple reads without separate query keys.
    const [balance, symbol, deposits] = await Promise.all([
      readVault.getBalance(userAddress),
      readVault.contract.read("symbol"),
      readVault.getDeposits(userAddress),
    ]);

    return { balance, symbol, deposits };
  });
}
```

No need to manage multiple hooks or query keys — Drift handles caching
internally, simplifying your code and development process.

## Caching in Action

Drift's caching mechanism ensures that repeated calls with the same parameters
don't result in unnecessary network requests, even when composed within the same
function.

```ts
// Return values are cached after the first call.
const balance = await contract.read("balanceOf", { account });

// Subsequent calls with the same parameters will return the cached value.
const fromCache = await contract.read("balanceOf", { account });

// Different parameters will trigger a network request.
const atBlock = await contract.read("balanceOf", { account }, { block: 123n });
const otherBalance = await contract.read("balanceOf", {
  account: "0xOtherAccount",
});
```

### Cache Invalidation

Delete cached data to ensure it's re-fetched using `invalidate*` and `clear*`
methods.

```ts
// Invalidate the cache for a specific read
contract.cache.invalidateRead("balanceOf", { account });

// Invalidate all reads matching partial arguments
contract.cache.invalidateReadsMatching("balanceOf");

// Clear all reads associated with the contract
contract.cache.clearReads();

// Let it all go...
contract.cache.clear();
```

### Preloading Cache Data

Add static data such as immutables from token lists using `preload*` methods to
avoid network requests without changing how the data is accessed.

```ts
const drift = createDrift(/* ... */);
const contract = drift.contract({
  abi: erc20Abi,
  // ...
});

// Preloading read data
contract.cache.preloadRead({ fn: "symbol", value: "DAI" });

// Preloading event data
contract.cache.preloadEvents({
  event: "Transfer",
  value: [],
  // ...
});
```

### Direct Access to Cached Data

Drift clients will automatically check the cache before fetching new data, but
direct access to the cached data is available via `get*` methods.

```ts
// Get a cached read return
const cachedBalance = await contract.cache.getRead("balanceOf", { account });

// Get a cached transaction receipt
const cachedReceipt = await drift.cache.getTransactionReceipt({ hash });
```

The `invalidate*`, `clear*`, `preload*`, and `get*` methods are available on
both the `Drift.cache` and `Contract.cache` instances.

> [!IMPORTANT]
>
> Manipulating cache data affects all clients that share the same cache. Since
> Drift passes its own cache to the contracts it creates via `Drift.contract()`,
> they'll already be preloaded with the `Drift` instance's cache and any cache
> operations performed on the contract cache will also affect the `Drift` cache.

## Extending Drift for Your Needs

Drift is designed to be extensible. You can build additional abstractions or
utilities on top of it to suit your project's requirements.

### Extension Points

#### Adapters

Extend support to new web3 libraries or custom providers by implementing the
[`Adapter`][Adapter] interface. Drift [`Clients`][Client], including
[`Drift`][Drift], extend the prototype of the `Adapter` they're provided,
inheriting all of it's properties and methods, extending some, and adding some
of their own. See the [`DefaultAdapter`][DefaultAdapter] for an example
implementation.

```ts
import { DefaultAdapter, createDrift } from "@gud/drift";

class CustomAdapter extends DefaultAdapter {
  override async getChainId() {
    // Custom implementation...
  }
}

const drift = await createDrift({
  adapter: new CustomAdapter({
    rpcUrl: process.env.RPC_URL,
  }),
});
```

#### Stores

The default store is an in-memory LRU cache. To persist the cache across page
reloads, pass the built-in [`WebStorageStore`][WebStorageStore], which is backed
by the [Web Storage
API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Storage_API)
(`localStorage` by default, or any compatible storage such as `sessionStorage`).
`BigInt` values are serialized safely out of the box.

```ts
import { createDrift, WebStorageStore } from "@gud/drift";

const drift = createDrift({
  // Persist the cache to localStorage across page reloads.
  store: new WebStorageStore(),
});
```

You can also implement a custom [`Store`][Store] to manage caching in a way that
suits your application, using TTL, IndexedDB,
[QueryClient](https://tanstack.com/query/latest/docs/reference/QueryClient), or
any other storage mechanism, sync or async.

```ts
import { createDrift } from "@gud/drift";

class CustomStore extends Map {
  override set(key: string, value: unknown) {
    // Custom implementation...
  }
}

const drift = createDrift({
  store: new CustomStore(),
});
```

### Hooks

Add custom logic by intercepting and modifying client methods with `hooks`. Each
client method (including custom adapter methods) has type-safe `before:<method>`
and `after:<method>` hooks that can be used to inspect and modify the arguments
or results.

```ts
// Simulate writes before sending transactions
drift.hooks.on("before:write", async ({ args: [params] }) => {
  await drift.simulateWrite(params);
});

// Run middleware on reads
drift.hooks.on("before:read", async ({ args: [params], resolve }) => {
  const cachedValue = await drift.cache.getRead(params);
  const result = await readMiddleware({ drift, params, cachedValue });
  resolve(result);
});

// Run middleware to transform the result of calls
drift.hooks.on("after:call", ({ args: [params], result, setResult }) => {
  const transformedResult = callResultMiddleware({ drift, params, result });
  setResult(transformedResult);
});
```

## Contributing

Got ideas or found a bug? Check the [Contributing
Guide](./.github/CONTRIBUTING.md) to get started.

## License

Drift is open-source software licensed under the [Apache 2.0](./LICENSE).

[Adapter]: ./packages/drift/src/adapter/types/Adapter.ts#L23
[DefaultAdapter]: ./packages/drift/src/adapter/DefaultAdapter.ts#L57
[Store]: ./packages/drift/src/store/Store.ts#L7
[WebStorageStore]: ./packages/drift/src/store/WebStorageStore.ts#L79
[Client]: ./packages/drift/src/client/Client.ts#L30
[Drift]: ./packages/drift/src/client/Drift.ts#L27
