import {
  type Block,
  type DecodedFunctionData,
  DriftError,
  type EventLog,
  type FunctionArgs,
  HEX_REGEX,
  type MulticallCallResult,
  type Transaction,
  type TransactionReceipt,
} from "@gud/drift";
import { mockErc20, testToken } from "@gud/drift/testing";
import { ViemReadAdapter } from "src/ViemReadAdapter";
import {
  type Address,
  createPublicClient,
  erc20Abi,
  http,
  zeroAddress,
} from "viem";
import { anvil } from "viem/chains";
import { assert, beforeAll, describe, expect, it } from "vitest";

const rpcUrl = process.env.VITE_RPC_URL || anvil.rpcUrls.default.http[0];
const publicClient = createPublicClient({
  transport: http(rpcUrl),
});
const adapter = new ViemReadAdapter({ publicClient });
const address = process.env.VITE_TOKEN_ADDRESS as Address;

describe("ViemReadAdapter", () => {
  beforeAll(() => {
    expect(
      address,
      "VITE_TOKEN_ADDRESS environment variable must be set to a valid token address",
    ).toBeDefined();
  });

  it("fetches the chain id", async () => {
    const chainId = await adapter.getChainId();
    expect(chainId).toBeTypeOf("number");
  });

  it("fetches the current block", async () => {
    const block = await adapter.getBlock();
    expect(block).toMatchObject({
      number: expect.any(BigInt),
      timestamp: expect.any(BigInt),
    } satisfies Partial<Block>);
  });

  it("fetches account balances", async () => {
    const balance = await adapter.getBalance({ address });
    expect(balance).toBeTypeOf("bigint");
  });

  it("fetches compiled bytecodes", async () => {
    const balance = await adapter.getBytecode({ address });
    expect(balance).toMatch(HEX_REGEX);
  });

  it("fetches the current gas price", async () => {
    const gasPrice = await adapter.getGasPrice();
    expect(gasPrice).toBeTypeOf("bigint");
  });

  it("fetches transactions", async () => {
    let block = await publicClient.getBlock();
    while (block.transactions.length === 0) {
      console.log(
        `No transactions in block ${block.number}. Fetching parent block.`,
      );
      block = await publicClient.getBlock({ blockHash: block.parentHash });
    }
    const tx = await adapter.getTransaction({
      hash: block.transactions[0]!,
    });
    expect(tx).toMatchObject({
      chainId: expect.toBeOneOf([expect.any(Number), undefined]),
      gas: expect.any(BigInt),
      gasPrice: expect.any(BigInt),
      input: expect.stringMatching(HEX_REGEX),
      nonce: expect.any(BigInt),
      type: expect.any(String),
      value: expect.any(BigInt),
      blockHash: expect.stringMatching(HEX_REGEX),
      blockNumber: expect.any(BigInt),
      from: expect.stringMatching(HEX_REGEX),
      transactionHash: expect.stringMatching(HEX_REGEX),
      to: expect.toBeOneOf([expect.stringMatching(HEX_REGEX), undefined]),
      transactionIndex: expect.any(Number),
    } satisfies Transaction);
  });

  it("returns receipts for waited transactions", async () => {
    let block = await publicClient.getBlock();
    while (block.transactions.length === 0) {
      console.log(
        `No transactions in block ${block.number}. Fetching parent block.`,
      );
      block = await publicClient.getBlock({ blockHash: block.parentHash });
    }
    const tx = await adapter.waitForTransaction({
      hash: block.transactions[0]!,
    });
    expect(tx).toMatchObject({
      contractAddress: expect.toBeOneOf([
        expect.stringMatching(HEX_REGEX),
        undefined,
      ]),
      to: expect.toBeOneOf([expect.stringMatching(HEX_REGEX), undefined]),
      blockHash: expect.stringMatching(HEX_REGEX),
      blockNumber: expect.any(BigInt),
      from: expect.stringMatching(HEX_REGEX),
      cumulativeGasUsed: expect.any(BigInt),
      effectiveGasPrice: expect.any(BigInt),
      gasUsed: expect.any(BigInt),
      logs: expect.any(Array),
      logsBloom: expect.stringMatching(HEX_REGEX),
      status: expect.stringMatching(/^(success|reverted)$/),
      transactionHash: expect.stringMatching(HEX_REGEX),
      transactionIndex: expect.any(Number),
    } satisfies TransactionReceipt);
  });

  describe("estimateGas", () => {
    it("estimates gas for target calls", async () => {
      const gas = await adapter.estimateGas({
        to: zeroAddress,
        value: 0n,
      });
      expect(gas).toEqual(expect.any(BigInt));
    });

    it("estimates gas for function and encoded function calls", async () => {
      const gas = await adapter.estimateGas({
        abi: erc20Abi,
        address,
        fn: "approve",
        args: { amount: 123n, spender: address },
      });
      const gas2 = await adapter.estimateGas({
        to: address,
        data: adapter.encodeFunctionData({
          abi: erc20Abi,
          fn: "approve",
          args: { amount: 123n, spender: address },
        }),
      });

      expect(gas).toEqual(expect.any(BigInt));
      expect(gas2).toEqual(expect.any(BigInt));
      assert(gas === gas2, `Gas estimates do not match: ${gas} !== ${gas2}`);
    });

    it("estimates gas for deploy and encoded deploy calls", async () => {
      const gas = await adapter.estimateGas({
        abi: testToken.abi,
        bytecode: testToken.bytecode,
        args: { decimals_: 18, initialSupply: 123n },
      });
      const gas2 = await adapter.estimateGas({
        data: adapter.encodeDeployData({
          abi: testToken.abi,
          bytecode: testToken.bytecode,
          args: { decimals_: 18, initialSupply: 123n },
        }),
      });

      expect(gas).toEqual(expect.any(BigInt));
      expect(gas2).toEqual(expect.any(BigInt));
      assert(gas === gas2, `Gas estimates do not match: ${gas} !== ${gas2}`);
    });
  });

  describe("call", () => {
    it("reads from deployed contracts", async () => {
      const data = adapter.encodeFunctionData({
        abi: erc20Abi,
        fn: "symbol",
      });
      const result = await adapter.call({
        to: address,
        data,
      });
      expect(result).toEqual(expect.stringMatching(/^0x/));
    });

    it("reads from bytecodes", async () => {
      const data = adapter.encodeFunctionData({
        abi: mockErc20.abi,
        fn: "name",
      });
      const result = await adapter.call({
        bytecode: mockErc20.bytecode,
        data,
      });
      expect(result).toEqual(expect.stringMatching(/^0x/));
    });
  });

  it("fetches events", async () => {
    const currentBlock = await publicClient.getBlockNumber();
    let event: EventLog<typeof erc20Abi, "Transfer"> | undefined;
    for (let i = 0; i <= 10 && !event; i++) {
      await new Promise((r) => setTimeout(r, 2 ** i * 100));
      const toBlock = currentBlock - 9n * BigInt(i);
      const events = await adapter.getEvents({
        abi: erc20Abi,
        address,
        event: "Transfer",
        fromBlock: toBlock - 9n,
        toBlock,
      });
      event = events[0];
    }
    assert(event, "No events found in the last 100 blocks");
    expect(event).toMatchObject({
      address: expect.stringMatching(HEX_REGEX),
      args: expect.any(Object),
      blockHash: expect.stringMatching(HEX_REGEX),
      blockNumber: expect.any(BigInt),
      data: expect.stringMatching(HEX_REGEX),
      eventName: "Transfer",
      logIndex: expect.any(Number),
      removed: expect.any(Boolean),
      topics: expect.any(Array),
      transactionHash: expect.stringMatching(HEX_REGEX),
      transactionIndex: expect.any(Number),
    } satisfies EventLog<typeof erc20Abi, "Transfer">);
  });

  describe("multicall", () => {
    it("reads multiple functions from contracts", async () => {
      const [symbolResult, decimalsResult] = await adapter.multicall({
        calls: [
          {
            abi: erc20Abi,
            address,
            fn: "symbol",
          },
          {
            abi: erc20Abi,
            address,
            fn: "decimals",
          },
        ],
      });
      expect(symbolResult).toMatchObject({
        success: true,
        value: expect.any(String),
      } satisfies MulticallCallResult);
      expect(decimalsResult).toMatchObject({
        success: true,
        value: expect.any(Number),
      } satisfies MulticallCallResult);
    });

    it("reads from contracts with args", async () => {
      const [balanceResult, transferResult] = await adapter.multicall({
        calls: [
          {
            abi: erc20Abi,
            address,
            fn: "balanceOf",
            args: { account: address },
          },

          {
            abi: erc20Abi,
            address,
            fn: "allowance",
            args: { owner: address, spender: address },
          },
        ],
      });

      expect(balanceResult).toMatchObject({
        success: true,
        value: expect.any(BigInt),
      } satisfies MulticallCallResult);
      expect(transferResult).toMatchObject({
        success: true,
        value: expect.any(BigInt),
      } satisfies MulticallCallResult);
    });

    it("returns errors for failed calls", async () => {
      const [transferResult] = await adapter.multicall({
        calls: [
          {
            abi: erc20Abi,
            address,
            fn: "transfer",
            args: {
              amount: BigInt(10_000e18),
              recipient: zeroAddress,
            },
          },
        ],
      });

      expect(transferResult).toMatchObject({
        success: false,
        error: expect.any(DriftError),
      } satisfies MulticallCallResult);
    });

    it("returns function values directly when allowFailure is false", async () => {
      const [decimals, symbol] = await adapter.multicall({
        allowFailure: false,
        calls: [
          {
            abi: erc20Abi,
            address,
            fn: "decimals",
          },
          {
            abi: erc20Abi,
            address,
            fn: "symbol",
          },
        ],
      });
      expect(decimals).toBeTypeOf("number");
      expect(symbol).toBeTypeOf("string");
    });
  });

  describe("read", () => {
    it("reads from contracts", async () => {
      const symbol = await adapter.read({
        abi: erc20Abi,
        address,
        fn: "symbol",
      });
      expect(symbol).toBeTypeOf("string");
    });

    it("reads from contracts with args", async () => {
      const balance = await adapter.read({
        abi: erc20Abi,
        address,
        fn: "balanceOf",
        args: { account: address },
      });
      expect(balance).toBeTypeOf("bigint");
    });
  });

  it("simulates writes to a contracts", async () => {
    const balance = await adapter.simulateWrite({
      abi: erc20Abi,
      address,
      fn: "transfer",
      args: {
        amount: 1n,
        recipient: address,
      },
    });
    expect(balance).toBeTypeOf("boolean");
  });

  it("encodes deploy data", async () => {
    const encoded = adapter.encodeDeployData({
      abi: testToken.abi,
      bytecode: testToken.bytecode,
      args: {
        decimals_: 18,
        initialSupply: 123n,
      },
    });
    assert(HEX_REGEX.test(encoded));
  });

  it("encodes function data", async () => {
    const encoded = adapter.encodeFunctionData({
      abi: erc20Abi,
      fn: "transfer",
      args: {
        amount: 123n,
        recipient: address,
      },
    });
    assert(HEX_REGEX.test(encoded));
  });

  it("encodes function return data", async () => {
    const encoded = adapter.encodeFunctionReturn({
      abi: erc20Abi,
      fn: "balanceOf",
      value: 123n,
    });
    expect(encoded).toEqual(
      "0x000000000000000000000000000000000000000000000000000000000000007b",
    );
  });

  it("decodes function data", async () => {
    const args: FunctionArgs<typeof erc20Abi, "transfer"> = {
      amount: 123n,
      recipient: address,
    };
    const decoded = adapter.decodeFunctionData({
      abi: erc20Abi,
      fn: "transfer",
      data: adapter.encodeFunctionData({
        abi: erc20Abi,
        fn: "transfer",
        args,
      }),
    });
    expect(decoded).toEqual({
      args,
      functionName: "transfer",
    } satisfies DecodedFunctionData<typeof erc20Abi, "transfer">);
  });

  it("decodes function return data", async () => {
    const decoded = adapter.decodeFunctionReturn({
      abi: erc20Abi,
      fn: "balanceOf",
      data: "0x000000000000000000000000000000000000000000000000000000000000007b",
    });
    expect(decoded).toEqual(123n);
  });
});
