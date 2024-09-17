import { AbiEntry } from 'src/contract/types/AbiEntry';
import { EvmClientError } from 'src/errors/EvmClientError';

export class AbiEntryNotFoundError extends EvmClientError {
  constructor(abi: Partial<AbiEntry>, options?: ErrorOptions) {
    super({
      name: 'AbiEntryNotFoundError',
      message: `No matching ABI entry found for ${JSON.stringify(abi)}`,
      options,
    });
  }
}
