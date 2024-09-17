import {
  AbiObjectType,
  DecodedFunctionData,
  FunctionName,
  FunctionReturn,
  ReadContract,
  ReadWriteContract,
  arrayToObject,
  objectToArray,
} from '@delvtech/evm-client';
import { createSimulateContractParameters } from 'src/contract/utils/createSimulateContractParameters';
import {
  Abi,
  Address,
  PublicClient,
  WalletClient,
  decodeFunctionData,
  encodeFunctionData,
} from 'viem';
import { createReadWriteContract } from './createReadWriteContract';
import { outputToFriendly } from './utils/outputToFriendly';

export interface CreateReadContractOptions<TAbi extends Abi = Abi> {
  abi: TAbi;
  address: Address;
  publicClient: PublicClient;
}

export interface ViemReadContract<TAbi extends Abi = Abi>
  extends ReadContract<TAbi> {
  /**
   * Connect a signer to upgrade the contract to a read-write contract.
   */
  connectWallet(walletClient: WalletClient): ReadWriteContract<TAbi>;
}

/**
 * Create a viem implementation of the ReadContract interface.
 * @see https://viem.sh/
 */
export function createReadContract<TAbi extends Abi = Abi>({
  abi,
  address,
  publicClient,
}: CreateReadContractOptions<TAbi>): ViemReadContract<TAbi> {
  return {
    abi,
    address,

    connectWallet(walletClient: WalletClient) {
      return createReadWriteContract({
        address,
        abi,
        publicClient,
        walletClient,
        readContract: this,
      });
    },

    async read(functionName, args, options) {
      const argsArray = objectToArray({
        abi,
        type: 'function',
        name: functionName,
        kind: 'inputs',
        value: args,
      });

      const output = await publicClient.readContract({
        abi: abi as Abi,
        address,
        functionName,
        args: argsArray,
        ...options,
      });

      return outputToFriendly({
        abi,
        functionName,
        output,
        argsArray,
      }) as FunctionReturn<TAbi, typeof functionName>;
    },

    async simulateWrite(functionName, args, options) {
      const argsArray = objectToArray({
        abi,
        type: 'function',
        name: functionName,
        kind: 'inputs',
        value: args,
      });

      const { result } = await publicClient.simulateContract({
        abi: abi as Abi,
        address,
        functionName,
        args: argsArray,
        ...createSimulateContractParameters(options),
      });

      return outputToFriendly({
        abi,
        functionName,
        output: result,
        argsArray,
      }) as FunctionReturn<TAbi, typeof functionName>;
    },

    async getEvents(eventName, options) {
      const events = await publicClient.getContractEvents({
        address,
        abi: abi as Abi,
        eventName: eventName as string,
        fromBlock: options?.fromBlock ?? 'earliest',
        toBlock: options?.toBlock ?? 'latest',
        args: options?.filter,
      });

      return events.map(({ args, blockNumber, data, transactionHash }) => {
        const objectArgs = Array.isArray(args)
          ? arrayToObject({
              abi: abi as Abi,
              type: 'event',
              name: eventName,
              kind: 'inputs',
              values: args,
            })
          : (args as AbiObjectType<TAbi, 'event', typeof eventName, 'inputs'>);

        return {
          args: objectArgs,
          blockNumber: blockNumber ?? undefined,
          data,
          eventName,
          transactionHash: transactionHash ?? undefined,
        };
      });
    },

    encodeFunctionData(functionName, args) {
      const arrayArgs = objectToArray({
        abi: abi,
        type: 'function',
        name: functionName,
        kind: 'inputs',
        value: args,
      });

      return encodeFunctionData({
        abi: abi as Abi,
        functionName: functionName as string,
        args: arrayArgs,
      });
    },

    decodeFunctionData<TFunctionName extends FunctionName<TAbi>>(
      data: `0x${string}`,
    ) {
      const { args, functionName } = decodeFunctionData({
        abi: abi,
        data,
      });

      const arrayArgs = Array.isArray(args) ? args : [args];

      return {
        args: arrayToObject({
          // Cast to allow any array type for values
          abi: abi as Abi,
          type: 'function',
          name: functionName,
          kind: 'inputs',
          values: arrayArgs,
        }),
        functionName,
      } as DecodedFunctionData<TAbi, TFunctionName>;
    },
  };
}
