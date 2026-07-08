import type { FunctionArgs, FunctionReturn } from "src/adapter/types/Function";
import { Overloaded } from "src/artifacts/Overloaded";
import { TestToken } from "src/artifacts/TestToken";
import type { OneOf } from "src/utils/types";
import { describe, expectTypeOf, it } from "vitest";

type OverloadedAbi = typeof Overloaded.abi;
type Erc20Abi = typeof TestToken.abi;

describe("FunctionArgs", () => {
  it("is a plain object for non-overloaded functions", () => {
    expectTypeOf<FunctionArgs<Erc20Abi, "transfer">>().toEqualTypeOf<{
      to: `0x${string}`;
      amount: bigint;
    }>();
  });

  it("is an empty object for functions with no args", () => {
    expectTypeOf<FunctionArgs<Erc20Abi, "symbol">>().toEqualTypeOf<
      Record<PropertyKey, never>
    >();
  });

  describe("overloaded functions", () => {
    it("discriminates overloads with different arg names", () => {
      type Args = FunctionArgs<OverloadedAbi, "diffArgNames">;

      expectTypeOf<Args>().toEqualTypeOf<
        OneOf<{ name: string } | { num: bigint }>
      >();

      // Each signature's args are individually assignable.
      expectTypeOf<{ name: "abc" }>().toExtend<Args>();
      expectTypeOf<{ num: 123n }>().toExtend<Args>();

      // Mixing args from both signatures is NOT allowed (the bug in #132).
      expectTypeOf<{ name: "abc"; num: 123n }>().not.toExtend<Args>();
    });

    it("discriminates overloads with different arity", () => {
      type Args = FunctionArgs<OverloadedAbi, "diffArgs">;

      expectTypeOf<{ a: 1n }>().toExtend<Args>();
      expectTypeOf<{ a: 1n; b: "x" }>().toExtend<Args>();
      // `b` alone (missing required `a`) is not a valid signature.
      expectTypeOf<{ b: "x" }>().not.toExtend<Args>();
    });

    it("handles overloads that share arg names but differ by type", () => {
      type Args = FunctionArgs<OverloadedAbi, "sameArgNames">;

      expectTypeOf<{ a: "x" }>().toExtend<Args>();
      expectTypeOf<{ a: 1n }>().toExtend<Args>();
    });

    it("discriminates overloads that include a no-arg signature", () => {
      // A no-arg overload contributes an "empty" object to the union, which
      // must not defeat discrimination of the other (named) overloads.
      const abi = [
        {
          type: "function",
          name: "foo",
          inputs: [],
          outputs: [],
          stateMutability: "view",
        },
        {
          type: "function",
          name: "foo",
          inputs: [{ name: "num", type: "uint256" }],
          outputs: [],
          stateMutability: "view",
        },
        {
          type: "function",
          name: "foo",
          inputs: [{ name: "name", type: "string" }],
          outputs: [],
          stateMutability: "view",
        },
      ] as const;
      type Args = FunctionArgs<typeof abi, "foo">;

      expectTypeOf<{ num: 123n }>().toExtend<Args>();
      expectTypeOf<{ name: "abc" }>().toExtend<Args>();
      expectTypeOf<Record<PropertyKey, never>>().toExtend<Args>();

      // Mixing args from different signatures is still rejected.
      expectTypeOf<{ num: 123n; name: "abc" }>().not.toExtend<Args>();
    });
  });
});

describe("FunctionReturn", () => {
  it("is unaffected by the args discrimination", () => {
    expectTypeOf<FunctionReturn<Erc20Abi, "symbol">>().toEqualTypeOf<string>();
    expectTypeOf<
      FunctionReturn<Erc20Abi, "balanceOf">
    >().toEqualTypeOf<bigint>();
  });
});
