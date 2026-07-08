---
"@gud/drift": minor
---

Added a `retry` utility that calls a function and retries it if it throws, with
a configurable `maxAttempts`, `delay` (fixed or a function of the attempt
number, defaulting to an exponential backoff), and `shouldRetry` predicate.
