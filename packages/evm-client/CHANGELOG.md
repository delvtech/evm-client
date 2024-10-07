# @delvtech/evm-client

## 0.5.2

### Patch Changes

- afa0069: Ensure Falsy values don't result in cache misses.

## 0.5.1

### Patch Changes

- 66d9dc3: Added `ConstructorArgs` type

## 0.5.0

### Minor Changes

- 919f525: Renamed `deleteReadMatch` to `deleteReadsMatching`

### Patch Changes

- 93531e6: Added getChainId method to the Network interface.

## 0.4.2

### Patch Changes

- 52edea9: Add deleteReadMatch method to CachedReadContract

## 0.4.1

### Patch Changes

- 4609a60: Export TransactionReceipt type

## 0.4.0

### Minor Changes

- 51fd2e4: Add status field to Transaction

## 0.3.1

### Patch Changes

- 5c35487: Fix error with `NamedEventInput` type which was broken and causing broken downstream types such as `EventFilter`

## 0.3.0

### Minor Changes

- 91106f8: Add a getBalance method to the Network interface for fetching native currency balances (e.g. ETH)

## 0.2.4

### Patch Changes

- 322edf5: Remove onTransactionMined

## 0.2.3

### Patch Changes

- e3880c8: Add txHash to onTransactionMined

## 0.2.2

### Patch Changes

- 01ec0b1: Add onTransactionMined callback to ReadWriteContract
- 01ec0b1: Make onTransactionMined optional

## 0.2.1

### Patch Changes

- 5f6a374: Add `waitForTransaction` method to `Network` type.

## 0.2.0

### Minor Changes

- affd95f: Add `entries` property to the `SimpleCache` type.

## 0.1.1

### Patch Changes

- eb6575b: Added a `cache` property to the `CachedReadContract` type and ensured the factories preserve the prototypes of the contract's they're given.

## 0.1.0

### Minor Changes

- cc17b3c: Changed the type of all inputs to objects. This means that functions with a single argument (e.g., `balanceOf` will now expect `` { owner: `0x${string}` } ``, not `` `0x${string}` ``). Outputs remain the "Friendly" type which deconstructs to a single primitive type for single outputs values (e.g., `symbol` will return a `string`, not `{ "0": string }`) since many single output return values are unnamed

## 0.0.11

### Patch Changes

- 1098f69: Fix bug causing stub lookups to fail

## 0.0.10

### Patch Changes

- 5cf2921: Add ability to stub options to stubRead

## 0.0.9

### Patch Changes

- dd129be: Use stable stringify for stub keys

## 0.0.8

### Patch Changes

- 593a286: Add ability to stub events for dynamic filter args

## 0.0.7

### Patch Changes

- 9db4f0f: Fix argument handling for parameters that have empty strings as names

## 0.0.6

### Patch Changes

- a2edb5a: Fix handling of single params

## 0.0.5

### Patch Changes

- 6307e1b: Fix the last fix...

## 0.0.4

### Patch Changes

- cfdf0db: Fix param prep for contract calls with single params

## 0.0.3

### Patch Changes

- 76b1bc8: Fix type resolutions by adding a `typeVersions` field to the `package.json`s
- fdcc9ef: Modify exports

## 0.0.2

### Patch Changes

- 6d60418: Added NetworkGetBlockOptions type

## 0.0.1

### Patch Changes

- e2f697f: Initial release! 🚀
