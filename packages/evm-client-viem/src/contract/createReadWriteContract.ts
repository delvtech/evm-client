import {
  objectToArray,
  type ReadContract,
  type ReadWriteContract,
} from "@delvtech/evm-client";
import {
  createReadContract,
  type CreateReadContractOptions,
} from "src/contract/createReadContract";
import { createSimulateContractParameters } from "src/contract/utils/createSimulateContractParameters";
import type { Abi, WalletClient } from "viem";

export interface ReadWriteContractOptions<TAbi extends Abi = Abi>
  extends CreateReadContractOptions<TAbi> {
  walletClient: WalletClient;
  readContract?: ReadContract<TAbi>;
}

/**
 * Create a viem implementation of the ReadWriteContract interface.
 * @see https://viem.sh/
 */
export function createReadWriteContract<TAbi extends Abi = Abi>({
  abi,
  address,
  publicClient,
  walletClient,
  readContract = createReadContract({ abi, address, publicClient }),
}: ReadWriteContractOptions<TAbi>): ReadWriteContract<TAbi> {
  return {
    ...readContract,

    async getSignerAddress() {
      const address = await walletClient
        .getAddresses()
        .then(([address]) => address);
      return address!;
    },

    // override to get the account from the wallet client
    async simulateWrite(functionName, args, options) {
      const [account] = await walletClient.getAddresses();

      return readContract.simulateWrite(functionName, args, {
        from: account,
        ...options,
      });
    },

    async write(functionName, args, options) {
      const [account] = await walletClient.getAddresses();

      const arrayArgs = objectToArray({
        abi: abi,
        type: "function",
        name: functionName,
        kind: "inputs",
        value: args,
      });

      const { request } = await publicClient.simulateContract({
        abi: abi as Abi,
        address: address,
        functionName,
        args: arrayArgs,
        ...createSimulateContractParameters({
          ...options,
          from: options?.from ?? account,
        }),
      });

      return walletClient.writeContract(request);
    },
  };
}
