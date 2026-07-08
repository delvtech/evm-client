import { DefaultAdapter } from "src/adapter/DefaultAdapter";
import type { Address, Hash } from "src/adapter/types/Abi";
import type { MulticallCallResult } from "src/adapter/types/Adapter";
import type { Block } from "src/adapter/types/Block";
import type { EventLog } from "src/adapter/types/Event";
import type {
  DecodedFunctionData,
  FunctionArgs,
} from "src/adapter/types/Function";
import type {
  Transaction,
  TransactionReceipt,
} from "src/adapter/types/Transaction";
import { MockERC20 } from "src/artifacts/MockERC20";
import { Overloaded } from "src/artifacts/Overloaded";
import { Overloaded1 } from "src/artifacts/Overloaded1";
import { Overloaded2 } from "src/artifacts/Overloaded2";
import { TestToken } from "src/artifacts/TestToken";
import { ZERO_ADDRESS } from "src/constants";
import { DriftError } from "src/error/DriftError";
import { HEX_REGEX } from "src/utils/hex";
import { assert, beforeAll, describe, expect, it } from "vitest";

const rpcUrl = process.env.VITE_RPC_URL;
const adapter = new DefaultAdapter({ rpcUrl });
const address = process.env.VITE_TOKEN_ADDRESS as Address;

describe("DefaultAdapter", () => {
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
      timestamp: expect.any(BigInt),
      extraData: expect.stringMatching(HEX_REGEX),
      gasLimit: expect.any(BigInt),
      gasUsed: expect.any(BigInt),
      hash: expect.stringMatching(HEX_REGEX),
      logsBloom: expect.stringMatching(HEX_REGEX),
      miner: expect.stringMatching(HEX_REGEX),
      mixHash: expect.stringMatching(HEX_REGEX),
      nonce: expect.any(BigInt),
      number: expect.any(BigInt),
      parentHash: expect.stringMatching(HEX_REGEX),
      receiptsRoot: expect.stringMatching(HEX_REGEX),
      sha3Uncles: expect.stringMatching(HEX_REGEX),
      size: expect.any(BigInt),
      stateRoot: expect.stringMatching(HEX_REGEX),
      transactions: expect.any(Array),
      transactionsRoot: expect.stringMatching(HEX_REGEX),
    } satisfies Block);
  });

  it("fetches account balances", async () => {
    const balance = await adapter.getBalance({ address });
    expect(balance).toBeTypeOf("bigint");
  });

  it("fetches compiled bytecodes", async () => {
    const bytecode = await adapter.getBytecode({ address });
    expect(bytecode).toMatch(HEX_REGEX || undefined);
  });

  it("fetches the current gas price", async () => {
    const gasPrice = await adapter.getGasPrice();
    expect(gasPrice).toBeTypeOf("bigint");
  });

  it("fetches transactions", async () => {
    let block: Block | undefined = await adapter.getBlock();
    while (block?.transactions.length === 0) {
      console.log(
        `No transactions in block ${block.number}. Fetching parent block.`,
      );
      block = await adapter.getBlock(block.parentHash);
    }
    const tx = await adapter.getTransaction({
      hash: block!.transactions[0]!,
    });
    expect(tx).toMatchObject({
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
      transactionIndex: expect.any(Number),
      chainId: expect.any(Number),
      to: expect.toBeOneOf([expect.stringMatching(HEX_REGEX), undefined]),
    } satisfies Transaction);
  });

  it("returns receipts for waited transactions", async () => {
    const blockNumber = await adapter.getBlockNumber();
    let block = await adapter.getBlock(blockNumber - 12n * 60n * 24n);
    while (block?.transactions.length === 0) {
      console.log(
        `No transactions in block ${block?.number}. Fetching parent block.`,
      );
      block = await adapter.getBlock(block.parentHash);
    }
    const tx = await adapter.waitForTransaction({
      hash: block!.transactions[0]!,
    });
    expect(tx).toMatchObject({
      blockHash: expect.stringMatching(HEX_REGEX),
      blockNumber: expect.any(BigInt),
      from: expect.stringMatching(HEX_REGEX),
      cumulativeGasUsed: expect.any(BigInt),
      effectiveGasPrice: expect.any(BigInt),
      gasUsed: expect.any(BigInt),
      logs: expect.any(Array),
      logsBloom: expect.stringMatching(HEX_REGEX),
      status: expect.stringMatching(/^(success|reverted)$/),
      to: expect.stringMatching(HEX_REGEX),
      transactionHash: expect.stringMatching(HEX_REGEX),
      transactionIndex: expect.any(Number),
      contractAddress: expect.toBeOneOf([
        expect.stringMatching(HEX_REGEX),
        undefined,
      ]),
    } satisfies TransactionReceipt);
  });

  describe("estimateGas", () => {
    it("estimates gas for target calls", async () => {
      const gas = await adapter.estimateGas({
        to: ZERO_ADDRESS,
        value: 0n,
      });
      expect(gas).toEqual(expect.any(BigInt));
    });

    it("estimates gas for function and encoded function calls", async () => {
      const gas = await adapter.estimateGas({
        abi: TestToken.abi,
        address,
        fn: "approve",
        args: { amount: 123n, spender: address },
      });
      const gas2 = await adapter.estimateGas({
        to: address,
        data: adapter.encodeFunctionData({
          abi: TestToken.abi,
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
        abi: TestToken.abi,
        bytecode: TestToken.bytecode,
        args: { decimals_: 18, initialSupply: 123n },
      });
      const gas2 = await adapter.estimateGas({
        data: adapter.encodeDeployData({
          abi: TestToken.abi,
          bytecode: TestToken.bytecode,
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
        abi: TestToken.abi,
        fn: "symbol",
      });
      const result = await adapter.call({
        to: address,
        data,
      });
      expect(result).toEqual(expect.stringMatching(HEX_REGEX));
    });

    it("reads from bytecodes", async () => {
      const data = adapter.encodeFunctionData({
        abi: MockERC20.abi,
        fn: "name",
      });
      const result = await adapter.call({
        bytecode: MockERC20.bytecode,
        data,
      });
      expect(result).toEqual(expect.stringMatching(HEX_REGEX));
    });
  });

  it("fetches events", async () => {
    const currentBlock = await adapter.getBlockNumber();
    let event: EventLog<typeof TestToken.abi, "Transfer"> | undefined;
    for (let i = 0; i <= 10 && !event; i++) {
      await new Promise((r) => setTimeout(r, 2 ** i * 100));
      const toBlock = currentBlock - 9n * BigInt(i);
      const events = await adapter.getEvents({
        abi: TestToken.abi,
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
    } satisfies EventLog<typeof TestToken.abi, "Transfer">);
  });

  describe("read", () => {
    it("reads from contracts", async () => {
      const symbol = await adapter.read({
        abi: TestToken.abi,
        address,
        fn: "symbol",
      });
      expect(symbol).toBeTypeOf("string");
    });

    it("reads from contracts with args", async () => {
      const balance = await adapter.read({
        abi: TestToken.abi,
        address,
        fn: "balanceOf",
        args: { owner: address },
      });
      expect(balance).toBeTypeOf("bigint");
    });
  });

  describe("multicall", () => {
    it("reads multiple functions from contracts", async () => {
      const [symbolResult, decimalsResult] = await adapter.multicall({
        calls: [
          {
            abi: TestToken.abi,
            address,
            fn: "symbol",
          },
          {
            abi: TestToken.abi,
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
            abi: TestToken.abi,
            address,
            fn: "balanceOf",
            args: { owner: address },
          },
          {
            abi: TestToken.abi,
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
            abi: TestToken.abi,
            address,
            fn: "transfer",
            args: {
              amount: BigInt(10_000e18),
              to: ZERO_ADDRESS,
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
            abi: TestToken.abi,
            address,
            fn: "decimals",
          },
          {
            abi: TestToken.abi,
            address,
            fn: "symbol",
          },
        ],
      });
      expect(decimals).toBeTypeOf("number");
      expect(symbol).toBeTypeOf("string");
    });
  });

  it("simulates writes to a contracts", async () => {
    const balance = await adapter.simulateWrite({
      abi: TestToken.abi,
      address,
      fn: "approve",
      args: {
        amount: 0n,
        spender: address,
      },
    });
    expect(balance).toBeTypeOf("boolean");
  });

  it("deploys contracts", async () => {
    const hash = await adapter.deploy({
      abi: TestToken.abi,
      bytecode: TestToken.bytecode,
      args: { decimals_: 18, initialSupply: 123n },
    });
    const receipt = await adapter.waitForTransaction({ hash });

    expect(hash).toMatch(HEX_REGEX);
    expect(receipt?.contractAddress).toMatch(HEX_REGEX);
  });

  it("sends transactions", async () => {
    const hash = await adapter.sendTransaction({
      data: adapter.encodeDeployData({
        abi: TestToken.abi,
        bytecode: TestToken.bytecode,
        args: { decimals_: 18, initialSupply: 123n },
      }),
    });
    const receipt = await adapter.waitForTransaction({ hash });

    expect(hash).toMatch(HEX_REGEX);
    expect(receipt?.contractAddress).toMatch(HEX_REGEX);
  });

  it("encodes deploy data", async () => {
    const encoded = adapter.encodeDeployData({
      abi: TestToken.abi,
      bytecode: TestToken.bytecode,
      args: { decimals_: 18, initialSupply: 123n },
    });
    assert(HEX_REGEX.test(encoded));
  });

  it("encodes function data", async () => {
    const encoded = adapter.encodeFunctionData({
      abi: TestToken.abi,
      fn: "transfer",
      args: { amount: 123n, to: address },
    });
    assert(HEX_REGEX.test(encoded));
  });

  // Ensures edge cases are handled correctly
  const tupleParamsAbi = [
    {
      name: "names",
      type: "function",
      inputs: [
        { name: "", type: "string" },
        { name: "", type: "string" },
      ],
      outputs: [
        { name: "", type: "string" },
        { name: "", type: "string" },
      ],
      stateMutability: "view",
    },
  ] as const;

  it("encodes function return data", async () => {
    const encoded = adapter.encodeFunctionReturn({
      abi: tupleParamsAbi,
      fn: "names",
      value: ["delv", "drift"],
    });
    expect(encoded).toEqual(
      "0x00000000000000000000000000000000000000000000000000000000000000400000000000000000000000000000000000000000000000000000000000000080000000000000000000000000000000000000000000000000000000000000000464656c760000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000056472696674000000000000000000000000000000000000000000000000000000",
    );
  });

  it("decodes function data", async () => {
    const args: FunctionArgs<typeof tupleParamsAbi, "names"> = {
      0: "delv",
      1: "drift",
    };
    const decoded = adapter.decodeFunctionData({
      abi: tupleParamsAbi,
      fn: "names",
      data: adapter.encodeFunctionData({
        abi: tupleParamsAbi,
        fn: "names",
        args,
      }),
    });
    expect(decoded).toEqual({
      args,
      functionName: "names",
    } as DecodedFunctionData<typeof tupleParamsAbi, "names">);
  });

  it("decodes function return data", async () => {
    const decoded = adapter.decodeFunctionReturn({
      abi: tupleParamsAbi,
      fn: "names",
      data: "0x00000000000000000000000000000000000000000000000000000000000000400000000000000000000000000000000000000000000000000000000000000080000000000000000000000000000000000000000000000000000000000000000464656c760000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000056472696674000000000000000000000000000000000000000000000000000000",
    });
    expect(decoded).toMatchObject({ 0: "delv", 1: "drift" });
  });

  describe("overloaded functions", async () => {
    let hash: Hash;
    let receipt: TransactionReceipt | undefined;
    let address: Address;

    beforeAll(async () => {
      hash = await adapter.deploy({
        abi: Overloaded.abi,
        bytecode: Overloaded.bytecode,
      });
      receipt = await adapter.waitForTransaction({ hash });
      address = receipt?.contractAddress!;
    });

    describe("multicall", () => {
      it("returns the correct value for overloaded functions with different args", async () => {
        const [return1, return2] = await adapter.multicall({
          calls: [
            {
              abi: Overloaded.abi,
              address,
              fn: "diffArgs",
              args: { a: 123n },
            },
            {
              abi: Overloaded.abi,
              address,
              fn: "diffArgs",
              args: { a: 123n, b: "foo" },
            },
          ],
          allowFailure: false,
        });
        expect(return1).toStrictEqual(123n);
        expect(return2).toStrictEqual("foo");
      });

      it("returns the correct value for overloaded functions with different arg names", async () => {
        const [return1, return2] = await adapter.multicall({
          calls: [
            {
              abi: Overloaded.abi,
              address,
              fn: "diffArgNames",
              args: { num: 123n },
            },
            {
              abi: Overloaded.abi,
              address,
              fn: "diffArgNames",
              args: { name: "foo" },
            },
          ],
          allowFailure: false,
        });
        expect(return1).toStrictEqual(123n);
        expect(return2).toStrictEqual("foo");
      });

      // FIXME:
      it.todo(
        "returns the correct value for overloaded functions with the same arg names",
        async () => {
          const [return1, return2] = await adapter.multicall({
            calls: [
              {
                abi: Overloaded.abi,
                address,
                fn: "sameArgNames",
                args: { a: 123n },
              },
              {
                abi: Overloaded.abi,
                address,
                fn: "sameArgNames",
                args: { a: "foo" },
              },
            ],
            allowFailure: false,
          });
          expect(return1).toStrictEqual(123n);
          expect(return2).toStrictEqual("foo");
        },
      );
    });

    describe("simulateWrite", () => {
      it("returns the correct value for overloaded functions with different args", async () => {
        const return1 = await adapter.simulateWrite({
          abi: Overloaded.abi,
          address,
          fn: "diffArgs",
          args: { a: 123n },
        });
        expect(return1).toStrictEqual(123n);

        const return2 = await adapter.simulateWrite({
          abi: Overloaded.abi,
          address,
          fn: "diffArgs",
          args: { a: 123n, b: "foo" },
        });
        expect(return2).toStrictEqual("foo");
      });

      it("returns the correct value for overloaded functions with different arg names", async () => {
        const return1 = await adapter.simulateWrite({
          abi: Overloaded.abi,
          address,
          fn: "diffArgNames",
          args: { num: 123n },
        });
        expect(return1).toStrictEqual(123n);

        const return2 = await adapter.simulateWrite({
          abi: Overloaded.abi,
          address,
          fn: "diffArgNames",
          args: { name: "foo" },
        });
        expect(return2).toStrictEqual("foo");
      });

      // FIXME:
      it.todo(
        "returns the correct value for overloaded functions with the same arg names",
        async () => {
          const return1 = await adapter.simulateWrite({
            abi: Overloaded.abi,
            address,
            fn: "sameArgNames",
            args: { a: 123n },
          });
          expect(return1).toStrictEqual(123n);

          const return2 = await adapter.simulateWrite({
            abi: Overloaded.abi,
            address,
            fn: "sameArgNames",
            args: { a: "foo" },
          });
          expect(return2).toStrictEqual("foo");
        },
      );
    });

    describe("read", () => {
      it("returns the correct value for overloaded functions with different args", async () => {
        const return1 = await adapter.read({
          abi: Overloaded.abi,
          address,
          fn: "diffArgs",
          args: { a: 123n },
        });
        expect(return1).toStrictEqual(123n);

        const return2 = await adapter.read({
          abi: Overloaded.abi,
          address,
          fn: "diffArgs",
          args: { a: 123n, b: "foo" },
        });
        expect(return2).toStrictEqual("foo");
      });

      it("returns the correct value for overloaded functions with different arg names", async () => {
        const return1 = await adapter.read({
          abi: Overloaded.abi,
          address,
          fn: "diffArgNames",
          args: { num: 123n },
        });
        expect(return1).toStrictEqual(123n);

        const return2 = await adapter.read({
          abi: Overloaded.abi,
          address,
          fn: "diffArgNames",
          args: { name: "foo" },
        });
        expect(return2).toStrictEqual("foo");
      });

      // FIXME:
      it.todo(
        "returns the correct value for overloaded functions with the same arg names",
        async () => {
          const return1 = await adapter.read({
            abi: Overloaded.abi,
            address,
            fn: "sameArgNames",
            args: { a: 123n },
          });
          expect(return1).toStrictEqual(123n);

          const return2 = await adapter.read({
            abi: Overloaded.abi,
            address,
            fn: "sameArgNames",
            args: { a: "foo" },
          });
          expect(return2).toStrictEqual("foo");
        },
      );
    });

    describe("encodeFunctionData", () => {
      it("encodes function data for overloaded functions with different args", () => {
        const data1 = adapter.encodeFunctionData({
          abi: Overloaded.abi,
          fn: "diffArgs",
          args: { a: 123n },
        });
        const expectedData1 = adapter.encodeFunctionData({
          abi: Overloaded1.abi,
          fn: "diffArgs",
          args: { a: 123n },
        });
        expect(data1).toEqual(expectedData1);

        const data2 = adapter.encodeFunctionData({
          abi: Overloaded.abi,
          fn: "diffArgs",
          args: { a: 123n, b: "foo" },
        });
        const expectedData2 = adapter.encodeFunctionData({
          abi: Overloaded2.abi,
          fn: "diffArgs",
          args: { a: 123n, b: "foo" },
        });
        expect(data2).toEqual(expectedData2);
      });

      it("encodes function data for overloaded functions with different arg names", () => {
        const data1 = adapter.encodeFunctionData({
          abi: Overloaded.abi,
          fn: "diffArgNames",
          args: { num: 123n },
        });
        const expectedData1 = adapter.encodeFunctionData({
          abi: Overloaded1.abi,
          fn: "diffArgNames",
          args: { num: 123n },
        });
        expect(data1).toEqual(expectedData1);

        const data2 = adapter.encodeFunctionData({
          abi: Overloaded.abi,
          fn: "diffArgNames",
          args: { name: "foo" },
        });
        const expectedData2 = adapter.encodeFunctionData({
          abi: Overloaded2.abi,
          fn: "diffArgNames",
          args: { name: "foo" },
        });
        expect(data2).toEqual(expectedData2);
      });

      // FIXME:
      it.todo(
        "encodes function data for overloaded functions with the same arg names",
        () => {
          const data1 = adapter.encodeFunctionData({
            abi: Overloaded.abi,
            fn: "sameArgNames",
            args: { a: 123n },
          });
          const expectedData1 = adapter.encodeFunctionData({
            abi: Overloaded1.abi,
            fn: "sameArgNames",
            args: { a: 123n },
          });
          expect(data1).toEqual(expectedData1);

          const data2 = adapter.encodeFunctionData({
            abi: Overloaded.abi,
            fn: "sameArgNames",
            args: { a: "foo" },
          });
          const expectedData2 = adapter.encodeFunctionData({
            abi: Overloaded2.abi,
            fn: "sameArgNames",
            args: { a: "foo" },
          });
          expect(data2).toEqual(expectedData2);
        },
      );
    });

    describe("encodeFunctionReturn", () => {
      // FIXME:
      it.todo(
        "encodes function return data for overloaded functions with different args",
        () => {
          const data1 = adapter.encodeFunctionReturn({
            abi: Overloaded.abi,
            fn: "diffArgs",
            value: 123n,
          });
          const expectedData1 = adapter.encodeFunctionReturn({
            abi: Overloaded1.abi,
            fn: "diffArgs",
            value: 123n,
          });
          expect(data1).toEqual(expectedData1);

          const data2 = adapter.encodeFunctionReturn({
            abi: Overloaded.abi,
            fn: "diffArgs",
            value: "foo",
          });
          const expectedData2 = adapter.encodeFunctionReturn({
            abi: Overloaded2.abi,
            fn: "diffArgs",
            value: "foo",
          });
          expect(data2).toEqual(expectedData2);
        },
      );

      // FIXME:
      it.todo(
        "encodes function return data for overloaded functions with different arg names",
        () => {
          const data1 = adapter.encodeFunctionReturn({
            abi: Overloaded.abi,
            fn: "diffArgNames",
            value: 123n,
          });
          const expectedData1 = adapter.encodeFunctionReturn({
            abi: Overloaded1.abi,
            fn: "diffArgNames",
            value: 123n,
          });
          expect(data1).toEqual(expectedData1);

          const data2 = adapter.encodeFunctionReturn({
            abi: Overloaded.abi,
            fn: "diffArgNames",
            value: "foo",
          });
          const expectedData2 = adapter.encodeFunctionReturn({
            abi: Overloaded2.abi,
            fn: "diffArgNames",
            value: "foo",
          });
          expect(data2).toEqual(expectedData2);
        },
      );

      // FIXME:
      it.todo(
        "encodes function return data for overloaded functions with the same arg names",
        () => {
          const data1 = adapter.encodeFunctionReturn({
            abi: Overloaded.abi,
            fn: "sameArgNames",
            value: 123n,
          });
          const expectedData1 = adapter.encodeFunctionReturn({
            abi: Overloaded1.abi,
            fn: "sameArgNames",
            value: 123n,
          });
          expect(data1).toEqual(expectedData1);

          const data2 = adapter.encodeFunctionReturn({
            abi: Overloaded.abi,
            fn: "sameArgNames",
            value: "foo",
          });
          const expectedData2 = adapter.encodeFunctionReturn({
            abi: Overloaded2.abi,
            fn: "sameArgNames",
            value: "foo",
          });
          expect(data2).toEqual(expectedData2);
        },
      );
    });

    describe("decodeFunctionData", () => {
      // FIXME:
      it.todo(
        "decodes function data for overloaded functions with different args",
        () => {
          const data1 = adapter.encodeFunctionData({
            abi: Overloaded.abi,
            fn: "diffArgs",
            args: { a: 123n },
          });
          const decoded1 = adapter.decodeFunctionData({
            abi: Overloaded.abi,
            fn: "diffArgs",
            data: data1,
          });
          expect(decoded1).toStrictEqual({
            args: { a: 123n },
            functionName: "diffArgs",
          } satisfies DecodedFunctionData<typeof Overloaded.abi, "diffArgs">);

          const data2 = adapter.encodeFunctionData({
            abi: Overloaded.abi,
            fn: "diffArgs",
            args: { a: 123n, b: "foo" },
          });
          const decoded2 = adapter.decodeFunctionData({
            abi: Overloaded.abi,
            fn: "diffArgs",
            data: data2,
          });
          expect(decoded2).toStrictEqual({
            args: { a: 123n, b: "foo" },
            functionName: "diffArgs",
          } satisfies DecodedFunctionData<typeof Overloaded.abi, "diffArgs">);
        },
      );

      it("decodes function data for overloaded functions with different arg names", () => {
        const data1 = adapter.encodeFunctionData({
          abi: Overloaded.abi,
          fn: "diffArgNames",
          args: { num: 123n },
        });
        const decoded1 = adapter.decodeFunctionData({
          abi: Overloaded.abi,
          fn: "diffArgNames",
          data: data1,
        });
        expect(decoded1).toStrictEqual({
          args: { num: 123n },
          functionName: "diffArgNames",
        } satisfies DecodedFunctionData<typeof Overloaded.abi, "diffArgNames">);

        const data2 = adapter.encodeFunctionData({
          abi: Overloaded.abi,
          fn: "diffArgNames",
          args: { name: "foo" },
        });
        const decoded2 = adapter.decodeFunctionData({
          abi: Overloaded.abi,
          fn: "diffArgNames",
          data: data2,
        });
        expect(decoded2).toStrictEqual({
          args: { name: "foo" },
          functionName: "diffArgNames",
        } satisfies DecodedFunctionData<typeof Overloaded.abi, "diffArgNames">);
      });

      // FIXME:
      it.todo(
        "decodes function data for overloaded functions with the same arg names",
        () => {
          const data1 = adapter.encodeFunctionData({
            abi: Overloaded.abi,
            fn: "sameArgNames",
            args: { a: 123n },
          });
          const decoded1 = adapter.decodeFunctionData({
            abi: Overloaded.abi,
            fn: "sameArgNames",
            data: data1,
          });
          expect(decoded1).toStrictEqual({
            args: { a: 123n },
            functionName: "sameArgNames",
          } satisfies DecodedFunctionData<
            typeof Overloaded.abi,
            "sameArgNames"
          >);

          const data2 = adapter.encodeFunctionData({
            abi: Overloaded.abi,
            fn: "sameArgNames",
            args: { a: "foo" },
          });
          const decoded2 = adapter.decodeFunctionData({
            abi: Overloaded.abi,
            fn: "sameArgNames",
            data: data2,
          });
          expect(decoded2).toStrictEqual({
            args: { a: "foo" },
            functionName: "sameArgNames",
          } satisfies DecodedFunctionData<
            typeof Overloaded.abi,
            "sameArgNames"
          >);
        },
      );
    });

    describe("decodeFunctionReturn", () => {
      // FIXME:
      it.todo(
        "decodes function return data for overloaded functions with different args",
        () => {
          const data1 = adapter.encodeFunctionReturn({
            abi: Overloaded.abi,
            fn: "diffArgs",
            value: 123n,
          });
          const decoded1 = adapter.decodeFunctionReturn({
            abi: Overloaded.abi,
            fn: "diffArgs",
            data: data1,
          });
          expect(decoded1).toStrictEqual(123n);

          const data2 = adapter.encodeFunctionReturn({
            abi: Overloaded.abi,
            fn: "diffArgs",
            value: "foo",
          });
          const decoded2 = adapter.decodeFunctionReturn({
            abi: Overloaded.abi,
            fn: "diffArgs",
            data: data2,
          });
          expect(decoded2).toStrictEqual("foo");
        },
      );

      // FIXME:
      it.todo(
        "decodes function return data for overloaded functions with different arg names",
        () => {
          const data1 = adapter.encodeFunctionReturn({
            abi: Overloaded.abi,
            fn: "diffArgNames",
            value: 123n,
          });
          const decoded1 = adapter.decodeFunctionReturn({
            abi: Overloaded.abi,
            fn: "diffArgNames",
            data: data1,
          });
          expect(decoded1).toStrictEqual(123n);

          const data2 = adapter.encodeFunctionReturn({
            abi: Overloaded.abi,
            fn: "diffArgNames",
            value: "foo",
          });
          const decoded2 = adapter.decodeFunctionReturn({
            abi: Overloaded.abi,
            fn: "diffArgNames",
            data: data2,
          });
          expect(decoded2).toStrictEqual("foo");
        },
      );

      // FIXME:
      it.todo(
        "decodes function return data for overloaded functions with the same arg names",
        () => {
          const data1 = adapter.encodeFunctionReturn({
            abi: Overloaded.abi,
            fn: "sameArgNames",
            value: 123n,
          });
          const decoded1 = adapter.decodeFunctionReturn({
            abi: Overloaded.abi,
            fn: "sameArgNames",
            data: data1,
          });
          expect(decoded1).toStrictEqual(123n);

          const data2 = adapter.encodeFunctionReturn({
            abi: Overloaded.abi,
            fn: "sameArgNames",
            value: "foo",
          });
          const decoded2 = adapter.decodeFunctionReturn({
            abi: Overloaded.abi,
            fn: "sameArgNames",
            data: data2,
          });
          expect(decoded2).toStrictEqual("foo");
        },
      );
    });
  });
});
