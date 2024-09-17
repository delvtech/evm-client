import { Abi, AbiItemType, AbiParameterKind } from 'abitype';
import {
  AbiArrayType,
  AbiEntryName,
  AbiFriendlyType,
} from 'src/contract/types/AbiEntry';
import { arrayToObject } from 'src/exports';

/**
 * Converts an array of input or output values into an
 * {@linkcode AbiFriendlyType}, ensuring the values are properly identified
 * based on their index.
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
 * const parsedArgs = arrayToFriendly({
 *   abi,
 *   type: "function",
 *   name: "transfer",
 *   kind: "inputs",
 *   values: ["0x123", 123n],
 * }); // -> { to: "0x123", value: 123n }
 *
 * const parsedReturn = arrayToFriendly({
 *   abi,
 *   type: "function",
 *   name: "transfer",
 *   kind: "outputs",
 *   values: [true],
 * }); // -> true
 *
 * const parsedFilter = arrayToFriendly({
 *   abi,
 *   type: "event",
 *   name: "Approval",
 *   kind: "inputs",
 *   values: [undefined, "0x123", undefined],
 * }); // -> { owner: undefined, spender: "0x123", value: undefined }
 * ```
 */
export function arrayToFriendly<
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
}): AbiFriendlyType<TAbi, TItemType, TName, TParameterKind> {
  const object = arrayToObject({ abi, type, name, kind, values });
  let [firstObjectEntry, ...rest] = Object.entries(object);

  // No parameters
  if (!firstObjectEntry) {
    return undefined as any;
  }

  // Single parameter
  if (!rest.length) {
    return firstObjectEntry[1];
  }

  // Multiple parameters
  return object as any;
}
