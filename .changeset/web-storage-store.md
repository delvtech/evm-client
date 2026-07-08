---
"@gud/drift": minor
---

Added `WebStorageStore`, a persistent `Store` implementation backed by the Web
Storage API (`localStorage` by default, or any compatible storage such as
`sessionStorage`). Pass it as the `store` option to persist a client's cache
across page reloads. `BigInt` values are serialized safely, and entries are
namespaced with a configurable `prefix`.
