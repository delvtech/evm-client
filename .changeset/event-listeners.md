---
"@gud/drift": minor
---

Added event listeners. `client.onEvent` and `contract.onEvent` invoke a callback
with new logs as matching contract events are emitted, `client.onBlock` fires as
new blocks are created, and `client.onSignerChange` fires when the signer
changes. Each listener polls the adapter on an interval and returns a function
that stops it. Also exported the `createPoller` utility and the
`EventListenerOptions`, `Unsubscribe`, `OnEventParams`, and
`OnContractEventOptions` types.
