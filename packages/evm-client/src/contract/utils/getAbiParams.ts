import { Abi, AbiItemType, AbiParameterKind } from 'abitype';
import { AbiEntryName, AbiParameters } from 'src/contract/types/AbiEntry';
import { getAbiEntries } from 'src/contract/utils/getAbiEntries';

/**
 * Get the params from an ABI by type, name, and kind.
 *
 * ABIs with overloaded functions will return multiple lists of parameters
 * sorted from least to most parameters.
 */
export function getAbiParams<
  TAbi extends Abi,
  TItemType extends AbiItemType,
  TName extends AbiEntryName<TAbi, TItemType>,
  TParameterKind extends AbiParameterKind,
>({
  abi,
  type,
  kind,
  name,
}: {
  abi: TAbi;
  type: TItemType;
  kind: TParameterKind;
  name?: TName;
}): AbiParameters<TAbi, TItemType, TName, TParameterKind>[] {
  return getAbiEntries({ abi, type, name })
    .map((entry) => (entry as any)[kind] || [])
    .sort((a, b) => a.length - b.length);
}
