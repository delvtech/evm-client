import { Abi, AbiItemType, AbiParameterKind } from 'abitype';
import {
  AbiArrayType,
  AbiEntryName,
  AbiObjectType,
} from 'src/contract/types/AbiEntry';
import { getAbiParams } from 'src/contract/utils/getAbiParams';
import { InvalidAbiParamsError } from 'src/errors/InvalidAbiParamsError';

/**
 * Converts an object into an array of input or output values, ensuring the the
 * correct number and order of values are present.
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
 * const preppedArgs = objectToArray({
 *   abi,
 *   type: "function",
 *   name: "transfer",
 *   kind: "inputs",
 *   value: { value: 123n, to: "0x123" },
 * }); // -> ["0x123", 123n]
 *
 * const preppedFilter = objectToArray({
 *   abi,
 *   type: "event",
 *   name: "Approval",
 *   kind: "inputs",
 *   value: { spender: "0x123" },
 * }); // -> [undefined, "0x123", undefined]
 * ```
 */
export function objectToArray<
  TAbi extends Abi,
  TItemType extends AbiItemType,
  TName extends AbiEntryName<TAbi, TItemType>,
  TParameterKind extends AbiParameterKind,
  TValue extends AbiObjectType<TAbi, TItemType, TName, TParameterKind>,
>({
  abi,
  type,
  name,
  kind,
  value,
}: {
  abi: TAbi;
  name: TName;
  kind: TParameterKind;
  type: TItemType;
  value?: Abi extends TAbi ? Record<string, unknown> : TValue;
}): AbiArrayType<TAbi, TItemType, TName, TParameterKind> {
  const valueObject: Record<string, unknown> =
    value && typeof value === 'object' ? value : {};

  // Find the parameters that match the number of values.
  const numValues = Object.keys(valueObject).length;
  const parameters = getAbiParams({ abi, type, name, kind }).find(
    (params) => params.length >= numValues,
  );

  if (!parameters) {
    throw new InvalidAbiParamsError({
      type,
      name,
      values: value,
    });
  }

  // No parameters
  if (!parameters.length) {
    return [] as AbiArrayType<TAbi, TItemType, TName, TParameterKind>;
  }

  const array = parameters.map(({ name }, i) => valueObject[name || i]);

  return array as AbiArrayType<TAbi, TItemType, TName, TParameterKind>;
}
