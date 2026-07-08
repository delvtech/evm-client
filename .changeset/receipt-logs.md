---
"@gud/drift": minor
---

Added a `logs` array to `TransactionReceipt` so the logs (events) emitted by a
transaction are now available from `waitForTransaction` across all adapters
(default, viem, ethers v6, ethers v5, and web3). Also added a new exported
`Log` type describing a raw, undecoded log entry.
