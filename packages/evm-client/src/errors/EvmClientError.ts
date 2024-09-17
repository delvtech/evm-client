export class EvmClientError extends Error {
  constructor({
    message,
    name,
    options,
  }: {
    message: string;
    name?: string;
    options?: ErrorOptions;
  }) {
    super(message, options);
    this.name = name || 'EvmClientError';
  }
}
