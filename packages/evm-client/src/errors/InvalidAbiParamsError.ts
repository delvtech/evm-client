import { AbiItemType } from 'abitype';
import { EvmClientError } from 'src/errors/EvmClientError';

export class InvalidAbiParamsError extends EvmClientError {
  constructor({
    type,
    name,
    values,
    options,
  }: {
    type: AbiItemType;
    name: string | undefined;
    values: any;
    options?: ErrorOptions;
  }) {
    const formattedValues = JSON.stringify(
      values,
      (_, value) => (typeof value === 'bigint' ? value.toString() : value),
      2,
    );
    super({
      name: 'InvalidAbiParamsError',
      message: `Invalid parameters for ABI ${type}${name ? ` ${name}` : ''}: ${formattedValues}`,
      options,
    });
  }
}
