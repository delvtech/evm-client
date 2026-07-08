// Adapter //

export { AbiEncoder } from "src/adapter/AbiEncoder";
export {
  type BaseAdapterOptions,
  BaseReadAdapter,
  BaseReadWriteAdapter,
} from "src/adapter/BaseAdapter";
export {
  DefaultAdapter,
  type DefaultAdapterOptions,
  DefaultReadAdapter,
} from "src/adapter/DefaultAdapter";
export {
  NotImplementedError,
  type NotImplementedErrorParams,
} from "src/adapter/errors";
export { deploy } from "src/adapter/methods/deploy";
export { multicall } from "src/adapter/methods/multicall";
export { read } from "src/adapter/methods/read";
export { simulateWrite } from "src/adapter/methods/simulateWrite";
export { write } from "src/adapter/methods/write";
export type {
  Abi,
  AbiArrayType,
  AbiEntry,
  AbiEntryName,
  AbiObjectType,
  AbiParameters,
  AbiParametersToObject,
  AbiSimplifiedType,
  Address,
  BaseTypeOverrides,
  Bytes,
  Hash,
  HexString,
  NamedAbiParameter,
} from "src/adapter/types/Abi";
export type {
  Adapter,
  BytecodeCallParams,
  CallOptions,
  CallParams,
  ContractParams,
  DecodeFunctionDataParams,
  DecodeFunctionReturnParams,
  DeployParams,
  EncodeDeployDataParams,
  EncodedDeployCallParams,
  EncodeFunctionDataParams,
  EncodeFunctionReturnParams,
  EstimateGasParams,
  FunctionCallParams,
  GetBalanceParams,
  GetBlockReturn,
  GetBytecodeParams,
  GetEventsOptions,
  GetEventsParams,
  GetTransactionParams,
  GetWalletCapabilitiesParams,
  MinedRangeBlock,
  MulticallCallParams,
  MulticallCallResult,
  MulticallOptions,
  MulticallParams,
  MulticallReturn,
  RangeBlock,
  ReadAdapter,
  ReadOptions,
  ReadParams,
  ReadWriteAdapter,
  SendCallsOptions,
  SendCallsParams,
  SendCallsReturn,
  SendTransactionParams,
  SimulateWriteOptions,
  SimulateWriteParams,
  TargetCallParams,
  WaitForTransactionParams,
  WalletCallOptions,
  WalletCallParams,
  WalletCallsStatus,
  WalletCapabilities,
  WalletCapabilitiesOptions,
  WalletCapability,
  WriteAdapter,
  WriteOptions,
  WriteParams,
} from "src/adapter/types/Adapter";
export type {
  BaseBlockProps,
  Block,
  BlockIdentifier,
  BlockOverrides,
  BlockStatus,
  BlockTag,
  MinedBlockIdentifier,
  MinedBlockProps,
} from "src/adapter/types/Block";
export type {
  EventArgs,
  EventFilter,
  EventLog,
  EventName,
} from "src/adapter/types/Event";
export type {
  ConstructorArgs,
  DecodedFunctionData,
  FunctionArgs,
  FunctionName,
  FunctionReturn,
  ReadFunctionName,
  WriteFunctionName,
} from "src/adapter/types/Function";
export type {
  Eip4844Options,
  MinedTransaction,
  Transaction,
  TransactionInfo,
  TransactionOptions,
  TransactionReceipt,
  WalletCallsReceipt,
} from "src/adapter/types/Transaction";
export { arrayToObject } from "src/adapter/utils/arrayToObject";
export { arrayToSimplified } from "src/adapter/utils/arrayToSimplified";
export { decodeFunctionData } from "src/adapter/utils/decodeFunctionData";
export { decodeFunctionReturn } from "src/adapter/utils/decodeFunctionReturn";
export { encodeBytecodeCallData } from "src/adapter/utils/encodeBytecodeCallData";
export {
  encodeDeployData,
  prepareDeployData,
} from "src/adapter/utils/encodeDeployData";
export {
  encodeFunctionData,
  prepareFunctionData,
} from "src/adapter/utils/encodeFunctionData";
export {
  encodeFunctionReturn,
  prepareFunctionReturn,
} from "src/adapter/utils/encodeFunctionReturn";
export {
  getMulticallAddress,
  type MulticallChainId,
} from "src/adapter/utils/getMulticallAddress";
export { getWalletCallsStatusLabel } from "src/adapter/utils/getWalletCallsStatusLabel";
export {
  type PrepareCallParams,
  type PreparedCall,
  prepareCall,
} from "src/adapter/utils/prepareCall";
export { prepareParams } from "src/adapter/utils/prepareParams";

// Store //

export {
  LruStore,
  type LruStoreOptions,
} from "src/store/LruStore";
export type { Store } from "src/store/Store";
export { deleteMatches } from "src/store/utils/deleteMatches";
export { getOrSet } from "src/store/utils/getOrSet";

// Client //

export {
  type Client,
  type ClientOptions,
  createClient,
  type GetBlockOptions,
  type GetBlockWithOptionsReturn,
  type OnEventParams,
} from "src/client/Client";
export {
  createPoller,
  DEFAULT_POLLING_INTERVAL,
  type EventListenerOptions,
  type Unsubscribe,
} from "src/client/utils/createPoller";

export {
  ClientCache,
  type ClientCacheOptions,
} from "src/client/cache/ClientCache";
export {
  type Contract,
  type ContractBaseOptions,
  type ContractEncodeDeployDataArgs,
  type ContractEncodeFunctionDataArgs,
  type ContractMulticallParams,
  type ContractMulticallReturn,
  type ContractOptions,
  type ContractReadArgs,
  type ContractSimulateWriteArgs,
  type ContractWriteArgs,
  createContract,
  type OnContractEventOptions,
  ReadContract,
  ReadWriteContract,
} from "src/client/contract/Contract";
export {
  ContractCache,
  type ContractCacheOptions,
} from "src/client/contract/cache/ContractCache";
export {
  createDrift,
  type Drift,
  type DriftOptions,
} from "src/client/Drift";
export { BlockNotFoundError } from "src/client/errors";

export type {
  HookHandler,
  HookMap,
  HookName,
  HookPayload,
  HookRegistry,
} from "src/client/hooks/HookRegistry";
export {
  type AfterMethodHook,
  type BeforeMethodHook,
  type MethodHooks,
  MethodInterceptor,
} from "src/client/hooks/MethodInterceptor";

// Artifacts //

export { IERC20 as erc20 } from "src/artifacts/IERC20";
export { IERC721 as erc721 } from "src/artifacts/IERC721";
export { IERC1155 as erc1155 } from "src/artifacts/IERC1155";
export { IERC4626 as erc4626 } from "src/artifacts/IERC4626";
export { IMulticall3 as multicall3 } from "src/artifacts/IMulticall3";

// DriftError //

export { DriftError, type DriftErrorOptions } from "src/error/DriftError";

// Utils //

export { type Converted, convert } from "src/utils/convert";
export {
  HEX_REGEX,
  hexToBytes,
  hexToString,
  InvalidHexStringError,
  type IsHexStringOptions,
  isHexString,
  type ToHexStringOptions,
  toHexString,
} from "src/utils/hex";
export { parseKey, stringifyKey } from "src/utils/keys";
export type {
  AnyFunction,
  AnyObject,
  DynamicProperty,
  EmptyObject,
  Eval,
  Extended,
  FunctionKey,
  MaybeAwaited,
  MaybePromise,
  OneOf,
  PartialBy,
  Replace,
  RequiredBy,
  RequiredValueKey,
  UnionKey,
} from "src/utils/types";

// ...Rest //

export { ZERO_ADDRESS } from "src/constants";
