import type { TransactionReceipt } from "src/adapter/types/Transaction";
import { createStubTransactionReceipt } from "src/adapter/utils/testing/createStubTransactionReceipt";
import { HEX_REGEX } from "src/utils/hex";
import { describe, expect, it } from "vitest";

describe("createStubTransactionReceipt", () => {
  it("creates a stub transaction with overrides", () => {
    const block = createStubTransactionReceipt({
      transactionHash: "0x123", // <--
    });
    expect(block).toStrictEqual({
      transactionHash: "0x123", // <--
      blockHash: expect.toBeOneOf([
        expect.stringMatching(HEX_REGEX),
        undefined,
      ]),
      blockNumber: expect.toBeOneOf([expect.any(BigInt), undefined]),
      from: expect.toBeOneOf([expect.stringMatching(HEX_REGEX), undefined]),
      transactionIndex: expect.toBeOneOf<number | undefined>([
        expect.any(Number),
        undefined,
      ]),
      cumulativeGasUsed: expect.any(BigInt),
      gasUsed: expect.any(BigInt),
      logs: expect.any(Array),
      logsBloom: expect.stringMatching(HEX_REGEX),
      status: expect.toBeOneOf([
        "success",
        "reverted",
      ]) satisfies TransactionReceipt["status"][],
      effectiveGasPrice: expect.any(BigInt),
      to: expect.toBeOneOf([expect.stringMatching(HEX_REGEX), undefined]),
      contractAddress: expect.toBeOneOf([
        expect.stringMatching(HEX_REGEX),
        undefined,
      ]),
    } satisfies TransactionReceipt);
  });
});
