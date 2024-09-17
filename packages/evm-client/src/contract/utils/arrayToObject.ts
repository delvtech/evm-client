import { Abi, AbiItemType, AbiParameterKind } from 'abitype';
import {
  AbiArrayType,
  AbiEntryName,
  AbiObjectType,
} from 'src/contract/types/AbiEntry';
import { getAbiParams } from 'src/contract/utils/getAbiParams';
import { InvalidAbiParamsError } from 'src/errors/InvalidAbiParamsError';

/**
 * Converts an array of input or output values into an object typ, ensuring the
 * values are properly identified based on their index.
 *
 * @example
 * ```ts
 * const abi = [
 *   {
 *     type: "function",
 *     name: "transfer",
 *     inputs: [
 *       { name: "to", type: "address" },
 *       { name: "value", type: "uint256" },
 *     ],
 *     outputs: [{ name: "", type: "bool" }],
 *     stateMutability: "nonpayable",
 *   },
 *   {
 *     type: "event",
 *     name: "Approval",
 *     inputs: [
 *       { indexed: true, name: "owner", type: "address" },
 *       { indexed: true, name: "spender", type: "address" },
 *       { indexed: false, name: "value", type: "uint256" },
 *     ],
 *   },
 * ] as const;
 *
 * const parsedArgs = arrayToObject({
 *   abi,
 *   type: "function",
 *   name: "transfer",
 *   kind: "inputs",
 *   values: ["0x123", 123n],
 * }); // -> { to: "0x123", value: 123n }
 *
 * const parsedFilter = arrayToObject({
 *   abi,
 *   type: "event",
 *   name: "Approval",
 *   kind: "inputs",
 *   values: [undefined, "0x123", undefined],
 * }); // -> { owner: undefined, spender: "0x123", value: undefined }
 * ```
 *
 * @throws If the number of values exceeds the number of parameters.
 */
export function arrayToObject<
  TAbi extends Abi,
  TItemType extends AbiItemType,
  TName extends AbiEntryName<TAbi, TItemType>,
  TParameterKind extends AbiParameterKind,
>({
  abi,
  type,
  name,
  kind,
  values,
}: {
  abi: TAbi;
  name: TName;
  values?: Abi extends TAbi
    ? readonly unknown[] // <- fallback for unknown ABI type
    : Partial<AbiArrayType<TAbi, TItemType, TName, TParameterKind>>;
  kind: TParameterKind;
  type: TItemType;
}): AbiObjectType<TAbi, TItemType, TName, TParameterKind> {
  const valuesArray = values || [];

  // Find the parameters that match the number of values.
  const params = getAbiParams({ abi, type, name, kind }).find(
    (params) => params.length >= valuesArray.length,
  );

  if (!params) {
    throw new InvalidAbiParamsError({
      type,
      name,
      values,
    });
  }

  return Object.fromEntries(
    params.map(({ name }, i) => [name || i, valuesArray[i]]),
  ) as any;
}
