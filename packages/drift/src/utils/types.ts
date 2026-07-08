export type EmptyObject = Record<PropertyKey, never>;
export type AnyObject = Record<PropertyKey, any>;

export type AnyFunction = (...args: any[]) => any;

export type MaybePromise<T> = T | Promise<T>;
export type MaybeAwaited<T> = T extends Promise<infer U> ? MaybePromise<U> : T;

/**
 * Unwrap the return type of a function that may return a promise.
 *
 * @internal
 * @privateRemarks
 * This fixes type errors that arise when trying to return
 * `Awaited<ReturnType<T>>` even though it's basically the same thing. I need to
 * do some more research to understand why this is necessary. I'm guessing it
 * has to do with distributive conditional types.
 */
export type AwaitedReturnType<T extends AnyFunction> = T extends (
  ...args: any
) => MaybePromise<infer U>
  ? U
  : never;

/**
 * Forces TypeScript to evaluate and expand a type instead of displaying it as a
 * reference.
 */
// The `& {}` intersection trick works because it forces TypeScript to create a
// new object type rather than just referencing the existing one.
export type Eval<T> = { [K in keyof T]: T[K] } & {};

/**
 * Narrow a base type to a specific subtype if the subtype is assignable to it,
 * otherwise keep the base type.
 *
 * @example
 * ```ts
 * type a = NarrowTo<string, "foo">  // "foo"
 * type b = NarrowTo<string, 123>    // string
 * ```
 *
 * @internal
 */
export type NarrowTo<Base, Specific> = Specific extends Base ? Specific : Base;

/**
 * Widen a specific type to a base type if it's assignable to the base,
 * otherwise keep the specific type.
 *
 * @example
 * ```ts
 * type a = WidenTo<"foo", string>   // string
 * type b = WidenTo<123, string>     // 123
 * ```
 *
 * @internal
 */
export type WidenTo<Specific, Base> = Specific extends Base ? Base : Specific;

/**
 * Replace properties in `T` with properties in `U`.
 */
export type Replace<T, U> = Omit<T, keyof U> & U;

/**
 * Make all properties in `T` whose keys are in the union `K` required. Similar
 * to `Required` but only applies to a subset of keys.
 */
export type RequiredBy<T, K extends keyof T | (string & {})> = Omit<T, K> &
  Required<Pick<T, K & keyof T>>;

/**
 * Make all properties in `T` whose keys are in the union `K` optional. Similar
 * to `Partial` but only applies to a subset of keys.
 */
export type PartialBy<T, K extends keyof T | (string & {})> = Omit<T, K> &
  Partial<Pick<T, K & keyof T>>;

/**
 * The opposite of {@linkcode Readonly<T>}. Make all properties in `T` mutable.
 *
 * @typeParam T - The type to make writable.
 * @typeParam TDeep - If `true`, recursively make all properties writable.
 */
export type Writable<T, TDeep extends boolean = false> = {
  -readonly [P in keyof T]: TDeep extends true
    ? NonNullable<T[P]> extends AnyObject | any[]
      ? Eval<Writable<T[P], TDeep>>
      : T[P]
    : T[P];
};

/**
 * Get a superset of `T` that allows additional arbitrary properties.
 *
 * @example
 *
 * ```ts
 * interface Order {
 *   account: `0x${string}`;
 *   amount: bigint;
 * }
 *
 * const order1: Order = {
 *   account: "0x123",
 *   amount: 100n,
 *   getStatus() { ... }
 *   // ^ Error: Object literal may only specify known properties, and 'getStatus' does not exist in type 'Order'.
 * };
 *
 * // No errors! 🎉
 * const order2: Extended<Order> = {
 *   account: "0x123",
 *   amount: 100n,
 *   getStatus() { ... }
 * };
 * ```
 *
 */
export type Extended<T extends AnyObject> = T &
  Record<Exclude<PropertyKey, keyof T>, any>;

/**
 * Get a union of all keys in `T` that are required, not `never`, and
 * not assignable to undefined.
 */
export type RequiredValueKey<T> = keyof {
  [K in keyof T as [T[K]] extends [never]
    ? never
    : undefined extends T[K]
      ? never
      : K]: any;
};

/**
 * Get a union of all keys in `T` that are options, `never`, or assignable to
 * undefined. (The opposite of {@linkcode RequiredValueKey<T>}).
 */
export type OptionalValueKey<T> = keyof {
  [K in Exclude<keyof T, RequiredValueKey<T>>]: any;
};

/**
 * Convert all properties in `T` that have optional values into optional properties.
 */
export type PartialByOptional<T> = PartialBy<T, OptionalValueKey<T>>;

/**
 * Get a union of all keys on `T` that are functions
 */
export type FunctionKey<T> = keyof {
  [K in keyof T as Required<T>[K] extends Function ? K : never]: never;
};

/**
 * Get a union of all keys from all members of `T`.
 */
export type UnionKey<T> = T extends T ? keyof T : never;

/**
 * Like {@linkcode UnionKey} but excludes wide index-signature keys (`string`,
 * `number`, `symbol`). A `Record<PropertyKey, never>` (i.e. an "empty" object)
 * therefore contributes no keys.
 *
 * Each member's keys are filtered _before_ they're unioned, otherwise a member
 * with a wide `string` key would absorb the literal keys of the other members
 * (`"a" | "b" | string` simplifies to `string`) and they'd all be stripped.
 */
export type NamedUnionKey<T> = T extends T
  ? keyof T extends infer K extends PropertyKey
    ? K extends K
      ? string extends K
        ? never
        : number extends K
          ? never
          : symbol extends K
            ? never
            : K
      : never
    : never
  : never;

/**
 * Construct a type in which only a single member of `T` is valid at a time.
 *
 * @example
 * ```ts
 * type U = OneOf<{ a: string } | { b: number }>;
 * // {
 * //   a: string;
 * //   b?: undefined;
 * // } | {
 * //   a?: undefined;
 * //   b: number;
 * // }
 * ```
 */
export type OneOf<T extends AnyObject> = UnionKey<T> extends infer K extends
  PropertyKey
  ? T extends T
    ? T & {
        [_ in Exclude<K, keyof T>]?: never;
      }
    : never
  : never;

/**
 * Like {@linkcode OneOf}, but only counts {@linkcode NamedUnionKey named keys}
 * when negating the keys of other members, and returns a non-union `T`
 * unchanged. This makes it safe to use on a union that includes an "empty"
 * object (`Record<PropertyKey, never>`), e.g. the parameters of an overloaded
 * entry where one overload takes no arguments, without polluting the other
 * members with `[x: string]: undefined` index signatures.
 *
 * @example
 * ```ts
 * type U = OneOfNamed<{ a: string } | Record<PropertyKey, never>>;
 * // { a: string } | Record<PropertyKey, never>
 * ```
 */
export type OneOfNamed<T extends AnyObject> =
  NamedUnionKey<T> extends infer K extends PropertyKey
    ? T extends T
      ? [Exclude<K, keyof T>] extends [never]
        ? T
        : T & {
            [_ in Exclude<K, keyof T>]?: never;
          }
      : never
    : never;

/**
 * Creates an object type with a single property `TKey`, which is made optional
 * if `TValue` is an "emptiable" type (e.g., `undefined`, `never`, `{}`, or an
 * object with only optional properties), Otherwise, the property is required.
 *
 * @example
 * ```ts
 * type Params1 = DynamicProperty<'options', { optional?: boolean }>;
 * // => { options?: { optional?: boolean } | undefined }
 *
 * type Params2 = DynamicProperty<'config', { required: string }>;
 * // => { config: { required: string } }
 * ```
 */
export type DynamicProperty<TKey extends PropertyKey, TValue> = {} extends
  | TValue
  | Pick<{ [K in TKey]: TValue }, RequiredValueKey<{ [K in TKey]: TValue }>>
  ? { [K in TKey]?: TValue }
  : { [K in TKey]: TValue };

/**
 * Extracts and transforms members of a union type `T` based on a filter type
 * `F`.
 *
 * It's similar to `Extract<T, U>` but rather than omitting members of `T` that
 * aren't wholly assignable to `U`, (e.g., omitting `{ a: string }` when `U` is
 * `{ a: 'foo' }`), it narrows values of `T` that the filter type `F` is
 * assignable to (e.g., `{ a: string }` is narrowed to `{ a: 'foo' }`).
 *
 * For each member in `T` (distributing over unions), if it includes all
 * required keys (as determined by {@linkcode RequiredValueKey<F>}), the type is
 * transformed by applying the filter:
 * - For each key `K` in `T` that exists in `F`, if `T[K]` is assignable to
 *   `F[K]`, the original type is kept.
 * - Otherwise, the type from `F[K]` is substituted in.
 *
 * **Important:** If the resulting transformed type is not assignable to the
 * original member of `T`, that union member is omitted from the output.
 *
 * @typeParam T - The union type whose members are to be filtered and
 * transformed.
 * @typeParam F - The filter type specifying required keys and their desired
 * types.
 *
 * @example
 * ```ts
 * type Filtered = ExtractFiltered<
 *   | { i: 0; a: string; c: boolean }
 *   | { i: 1; b: number }
 *   | { i: 2; c: boolean },
 *   { i: number; c: true }
 * >;
 * // => { i: 0; a: string; c: true } | { i: 2; c: true };
 *
 * type FilteredPartial = ExtractFiltered<{ a: string; b: number; c: boolean }, { a: 'foo' }>;
 * // => { a: 'foo'; b: number; c: boolean }
 * ```
 *
 * @internal
 */
export type ExtractFiltered<T, F = {}> = T extends T // <- Distribute union
  ? RequiredValueKey<F> extends keyof T
    ? ApplyFilter<T, F>
    : never // <- Omit if entry is missing a required value
  : never;

/**
 * Transforms a type `T` based on a filter type `F`, returning `never` if the
 * result is not assignable to `T`.
 *
 * It's similar to creating the intersection `T & F`, but returns `never` if the
 * types don't overlap.
 *
 * @typeParam T - The type to be transformed.
 * @typeParam F - The filter type specifying the desired transformations.
 *
 * @example
 * ```ts
 * type Filtered = ApplyFilter<
 *   { a: string; b: true },
 *   { a: "foo"; b: boolean }
 * >;
 * // => { a: 'foo'; b: true }
 *
 * type Filtered2 = ApplyFilter<{ a: string }, { a: number }>;
 * // => never
 * ```
 *
 * @internal
 */
export type ApplyFilter<T, F> = {
  [K in keyof T]: K extends keyof F
    ? NarrowTo<F[K], T[K]> // <- Leave value as-is if it fits the filter
    : T[K]; // <- Leave value as-is if the key isn't in the filter
} extends infer TF extends T
  ? TF // <- Return the transformed type if it's assignable to T
  : never;
