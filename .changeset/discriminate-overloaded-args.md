---
"@gud/drift": patch
---

Fixed the inferred args type for overloaded functions (and events) so it's a
discriminated union: only the arguments of a single overload can be provided at
a time, rather than a plain union that allowed mixing arguments from different
overloads. Also added `OneOfNamed` and `NamedUnionKey` type utilities.
