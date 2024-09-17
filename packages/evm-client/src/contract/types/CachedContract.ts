import { Abi } from 'abitype';
import {
  ContractReadArgs,
  ReadContract,
  ReadWriteContract,
} from 'src/contract/types/Contract';
import { FunctionName } from 'src/contract/types/Function';
import { SimpleCache } from 'src/exports';

export interface CachedReadContract<TAbi extends Abi = Abi>
  extends ReadContract<TAbi> {
  cache: SimpleCache;
  namespace?: string;
  clearCache(): void;
  deleteRead<TFunctionName extends FunctionName<TAbi>>(
    ...[functionName, args, options]: ContractReadArgs<TAbi, TFunctionName>
  ): void;
  deleteReadsMatching<TFunctionName extends FunctionName<TAbi>>(
    ...[functionName, args, options]: DeepPartial<
      ContractReadArgs<TAbi, TFunctionName>
    >
  ): void;
}

export interface CachedReadWriteContract<TAbi extends Abi = Abi>
  extends CachedReadContract<TAbi>,
    ReadWriteContract<TAbi> {}

/** Recursively make all properties in T partial. */
type DeepPartial<T> = {
  [K in keyof T]?: DeepPartial<T[K]>;
};
