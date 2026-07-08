import { DriftError } from "src/error/DriftError";
import type { Store } from "src/store/Store";

/**
 * A tag used to encode `BigInt` values as a wrapper object when serializing.
 * Unlike a plain `"123n"` string suffix, a wrapper object round-trips
 * unambiguously and never collides with a real string value that happens to
 * look like a `BigInt` (e.g. a contract's `string` return of `"123n"`).
 */
const BIGINT_TAG = "$drift$bigint";

/**
 * Serializes a value to a JSON string for {@linkcode WebStorageStore}, encoding
 * `BigInt`s so they round-trip without corrupting look-alike string values.
 */
export function serializeValue(value: unknown): string {
  return JSON.stringify(value, (_key, v) =>
    typeof v === "bigint" ? { [BIGINT_TAG]: v.toString() } : v,
  );
}

/**
 * Parses a string produced by {@linkcode serializeValue}, restoring `BigInt`
 * values.
 */
export function deserializeValue(text: string): unknown {
  return JSON.parse(text, (_key, v) => {
    if (typeof v === "object" && v !== null && Object.keys(v).length === 1) {
      const tagged = (v as Record<string, unknown>)[BIGINT_TAG];
      if (typeof tagged === "string") {
        return BigInt(tagged);
      }
    }
    return v;
  });
}

/**
 * A minimal subset of the [Web Storage
 * API](https://developer.mozilla.org/en-US/docs/Web/API/Storage) used by
 * {@linkcode WebStorageStore}. Both `localStorage` and `sessionStorage` satisfy
 * this interface, as do most storage polyfills.
 */
export interface WebStorage {
  readonly length: number;
  key: (index: number) => string | null;
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
}

export interface WebStorageStoreOptions {
  /**
   * The underlying Web Storage to persist entries to.
   *
   * @default globalThis.localStorage
   */
  storage?: WebStorage;

  /**
   * A prefix prepended to every key written to {@linkcode storage}. This
   * namespaces the store's entries so they don't collide with other data in the
   * same storage, and ensures {@linkcode WebStorageStore.entries entries} and
   * {@linkcode WebStorageStore.clear clear} only touch entries created by this
   * store. A non-empty prefix is required for that isolation; an empty prefix
   * makes the store operate on every entry in the storage.
   *
   * @default "drift:"
   */
  prefix?: string;

  /**
   * Serializes a value into a string for storage. Defaults to a `BigInt`-safe
   * JSON serializer ({@linkcode serializeValue}). Override to add compression,
   * encryption, etc.
   */
  serialize?: (value: any) => string;

  /**
   * Deserializes a stored string back into a value. Must be the inverse of
   * {@linkcode WebStorageStoreOptions.serialize serialize}. Defaults to a
   * `BigInt`-safe JSON parser ({@linkcode deserializeValue}).
   */
  deserialize?: (value: string) => any;
}

/**
 * A persistent {@linkcode Store} implementation backed by the [Web Storage
 * API](https://developer.mozilla.org/en-US/docs/Web/API/Storage), e.g.
 * `localStorage` or `sessionStorage`.
 *
 * This lets a client's cache survive page reloads. Values are serialized with a
 * `BigInt`-safe JSON serializer by default, and every entry is namespaced with
 * a {@linkcode WebStorageStoreOptions.prefix prefix} so it won't collide with
 * other data in the same storage.
 *
 * @example
 * ```ts
 * import { createDrift, WebStorageStore } from "@gud/drift";
 *
 * const drift = createDrift({
 *   adapter,
 *   // Persist the cache to localStorage across page reloads.
 *   store: new WebStorageStore(),
 * });
 * ```
 *
 * @see [Web Storage API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Storage_API)
 */
export class WebStorageStore implements Store {
  readonly storage: WebStorage;
  readonly prefix: string;
  #serialize: (value: any) => string;
  #deserialize: (value: string) => any;

  constructor({
    storage = (globalThis as { localStorage?: WebStorage }).localStorage,
    prefix = "drift:",
    serialize = serializeValue,
    deserialize = deserializeValue,
  }: WebStorageStoreOptions = {}) {
    if (!storage) {
      throw new DriftError(
        "No web storage available. Pass a `storage` option to `WebStorageStore` (e.g. `localStorage`, `sessionStorage`, or a compatible polyfill).",
      );
    }
    this.storage = storage;
    this.prefix = prefix;
    this.#serialize = serialize;
    this.#deserialize = deserialize;
  }

  #prefixed(key: string): string {
    return `${this.prefix}${key}`;
  }

  /**
   * Returns all entries created by this store, with the {@linkcode prefix}
   * stripped from each key.
   */
  entries(): [string, any][] {
    const entries: [string, any][] = [];
    // Snapshot into an array so mutations during iteration (e.g. `delete`
    // calls from `deleteMatches`) don't shift storage indices and skip entries.
    for (let i = 0; i < this.storage.length; i++) {
      const key = this.storage.key(i);
      if (key?.startsWith(this.prefix)) {
        const value = this.storage.getItem(key);
        if (value !== null) {
          entries.push([
            key.slice(this.prefix.length),
            this.#deserialize(value),
          ]);
        }
      }
    }
    return entries;
  }

  has(key: string): boolean {
    return this.storage.getItem(this.#prefixed(key)) !== null;
  }

  get(key: string): any {
    const value = this.storage.getItem(this.#prefixed(key));
    return value === null ? undefined : this.#deserialize(value);
  }

  set(key: string, value: any): void {
    const prefixedKey = this.#prefixed(key);
    const serialized: string | undefined = this.#serialize(value);
    // A value with no serialized form (e.g. `undefined`, a function, or a
    // symbol) can't be persisted. Remove any stale entry so `has`/`get` stay
    // consistent rather than storing the string "undefined".
    if (serialized === undefined) {
      this.storage.removeItem(prefixedKey);
      return;
    }
    try {
      this.storage.setItem(prefixedKey, serialized);
    } catch {
      // Persisting is best-effort: swallow write failures (e.g. an exceeded
      // storage quota or private-mode storage) so a failed cache write never
      // fails the caller. The value is simply re-fetched on the next miss.
    }
  }

  delete(key: string): void {
    this.storage.removeItem(this.#prefixed(key));
  }

  /**
   * Removes every entry created by this store. Entries in the underlying
   * {@linkcode storage} that don't match the {@linkcode prefix} are left
   * untouched.
   */
  clear(): void {
    const keys: string[] = [];
    // Snapshot matching keys before removing, since `removeItem` shifts indices.
    for (let i = 0; i < this.storage.length; i++) {
      const key = this.storage.key(i);
      if (key?.startsWith(this.prefix)) {
        keys.push(key);
      }
    }
    for (const key of keys) {
      this.storage.removeItem(key);
    }
  }
}
