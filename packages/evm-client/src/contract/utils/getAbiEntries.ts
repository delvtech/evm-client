import { Abi, AbiItemType } from 'abitype';
import { AbiEntry, AbiEntryName } from 'src/contract/types/AbiEntry';
import { AbiEntryNotFoundError } from 'src/errors/AbiEntryNotFoundError';

/**
 * Get entries from an ABI by type and name.
 *
 * ABIs with overloaded functions will return multiple entries.
 *
 * @throws If no matching entries are found.
 */
export function getAbiEntries<
  TAbi extends Abi,
  TItemType extends AbiItemType,
  TName extends AbiEntryName<TAbi, TItemType>,
>({
  abi,
  type,
  name,
}: {
  abi: TAbi;
  type: TItemType;
  name?: TName;
}): AbiEntry<TAbi, TItemType, TName>[] {
  const entries = abi.filter(
    (item) =>
      item.type === type &&
      (type === 'constructor' || (item as any).name === name),
  ) as AbiEntry<TAbi, TItemType, TName>[];

  if (!entries.length) {
    throw new AbiEntryNotFoundError({ type, name });
  }

  return entries;
}
