import { ClientCache } from "src/client/cache/ClientCache";
import { type WebStorage, WebStorageStore } from "src/store/WebStorageStore";
import { describe, expect, it } from "vitest";

/**
 * In-memory implementation of the {@linkcode WebStorage} interface for testing,
 * mirroring how `localStorage` behaves.
 */
class MemoryStorage implements WebStorage {
  #map = new Map<string, string>();
  get length() {
    return this.#map.size;
  }
  key(index: number) {
    return [...this.#map.keys()][index] ?? null;
  }
  getItem(key: string) {
    const value = this.#map.get(key);
    return value === undefined ? null : value;
  }
  setItem(key: string, value: string) {
    // Real Web Storage coerces the value to a string.
    this.#map.set(key, String(value));
  }
  removeItem(key: string) {
    this.#map.delete(key);
  }
}

describe("WebStorageStore", () => {
  it("throws a helpful error when no storage is available", () => {
    // No `globalThis.localStorage` in the test (node) environment.
    expect(() => new WebStorageStore()).toThrowError(/web storage/i);
  });

  it("round-trips values, including bigints", async () => {
    const store = new WebStorageStore({ storage: new MemoryStorage() });

    await store.set("bigint", 123n);
    await store.set("hex", "0xabc");
    await store.set("object", { balance: 456n, address: "0x123", ok: true });
    await store.set("array", [1n, 2n, 3n]);

    expect(await store.get("bigint")).toBe(123n);
    expect(await store.get("hex")).toBe("0xabc");
    expect(await store.get("object")).toEqual({
      balance: 456n,
      address: "0x123",
      ok: true,
    });
    expect(await store.get("array")).toEqual([1n, 2n, 3n]);
  });

  it("keeps string values that look like bigints as strings", async () => {
    const store = new WebStorageStore({ storage: new MemoryStorage() });

    // Plain strings that resemble a serialized bigint must NOT become bigints.
    await store.set("a", "42n");
    await store.set("b", "-100n");
    await store.set("c", { note: "7n", amount: 7n });

    expect(await store.get("a")).toBe("42n");
    expect(await store.get("b")).toBe("-100n");
    expect(await store.get("c")).toEqual({ note: "7n", amount: 7n });
    expect(typeof (await store.get("c")).note).toBe("string");
    expect(typeof (await store.get("c")).amount).toBe("bigint");
  });

  it("never mistakes a real object for an encoded bigint", async () => {
    const store = new WebStorageStore({ storage: new MemoryStorage() });

    // An object of any shape must round-trip as an object, never be coerced to
    // a bigint or throw, regardless of its keys/values.
    const numericLookalike = { $drift$bigint: "123" };
    const nonNumericLookalike = { $drift$bigint: "abc" };
    await store.set("numeric", numericLookalike);
    await store.set("nonNumeric", nonNumericLookalike);

    expect(await store.get("numeric")).toEqual(numericLookalike);
    expect(typeof (await store.get("numeric")).$drift$bigint).toBe("string");
    expect(await store.get("nonNumeric")).toEqual(nonNumericLookalike);
    // Enumeration must not throw over these entries.
    expect(() => [...store.entries()]).not.toThrow();
  });

  it("treats an unserializable value as a delete", async () => {
    const storage = new MemoryStorage();
    const store = new WebStorageStore({ storage });

    await store.set("key", 1n);
    expect(await store.has("key")).toBe(true);

    // A value with no JSON form must clear the entry, not poison it.
    await store.set("key", undefined as any);
    expect(await store.has("key")).toBe(false);
    expect(await store.get("key")).toBeUndefined();
    // Enumeration must not throw over the (now absent) entry.
    expect([...store.entries()]).toEqual([]);
  });

  it("swallows storage write failures (best-effort persistence)", async () => {
    const storage = new MemoryStorage();
    storage.setItem = () => {
      throw new DOMException("quota", "QuotaExceededError");
    };
    const store = new WebStorageStore({ storage });

    // A full/failing storage must not throw out of set().
    expect(() => store.set("key", 123n)).not.toThrow();
    expect(store.get("key")).toBeUndefined();
  });

  it("reports presence and deletes entries", async () => {
    const store = new WebStorageStore({ storage: new MemoryStorage() });

    expect(await store.has("key")).toBe(false);
    expect(await store.get("key")).toBeUndefined();

    await store.set("key", 1n);
    expect(await store.has("key")).toBe(true);

    await store.delete("key");
    expect(await store.has("key")).toBe(false);
    expect(await store.get("key")).toBeUndefined();
  });

  it("persists across store instances over the same storage", async () => {
    const storage = new MemoryStorage();

    const store1 = new WebStorageStore({ storage });
    await store1.set("persisted", 789n);

    // Simulate a page reload: a brand new store over the same storage.
    const store2 = new WebStorageStore({ storage });
    expect(await store2.get("persisted")).toBe(789n);
  });

  it("namespaces entries with a prefix and ignores foreign keys", async () => {
    const storage = new MemoryStorage();
    // A key written by something other than the store.
    storage.setItem("unrelated", "keep me");

    const store = new WebStorageStore({ storage, prefix: "myapp:" });
    await store.set("a", 1n);
    await store.set("b", 2n);

    // Physical keys are prefixed.
    expect(storage.getItem("myapp:a")).toBeDefined();

    // `entries` yields only the store's own keys, with the prefix stripped.
    const entries = [...store.entries()].sort();
    expect(entries).toEqual([
      ["a", 1n],
      ["b", 2n],
    ]);

    // `clear` only removes the store's own entries.
    await store.clear();
    expect([...store.entries()]).toEqual([]);
    expect(storage.getItem("unrelated")).toBe("keep me");
  });

  it("supports a custom serializer/deserializer", async () => {
    const store = new WebStorageStore({
      storage: new MemoryStorage(),
      serialize: (value) => `json:${JSON.stringify(value)}`,
      deserialize: (value) => JSON.parse(value.replace(/^json:/, "")),
    });

    await store.set("k", { a: 1, b: [2, 3] });
    expect(await store.get("k")).toEqual({ a: 1, b: [2, 3] });
  });

  describe("as a ClientCache store", () => {
    it("persists cached values across a reload", async () => {
      const storage = new MemoryStorage();
      const address = "0x0000000000000000000000000000000000000001" as const;

      const cache = new ClientCache({
        namespace: 1,
        store: new WebStorageStore({ storage }),
      });
      await cache.preloadBalance({ address, value: 1_000n });
      expect(await cache.getBalance({ address })).toBe(1_000n);

      // Fresh cache over the same storage still has the balance.
      const reloaded = new ClientCache({
        namespace: 1,
        store: new WebStorageStore({ storage }),
      });
      expect(await reloaded.getBalance({ address })).toBe(1_000n);
    });

    it("supports namespaced invalidation via deleteMatches", async () => {
      const storage = new MemoryStorage();
      const a = "0x0000000000000000000000000000000000000001" as const;
      const b = "0x0000000000000000000000000000000000000002" as const;

      const cache = new ClientCache({
        namespace: 1,
        store: new WebStorageStore({ storage }),
      });
      await cache.preloadBalance({ address: a, value: 1n });
      await cache.preloadBalance({ address: b, value: 2n });
      await cache.preloadBlock({ value: { number: 7n } as any });

      // Clears only balances, leaving the block cached.
      await cache.clearBalances();
      expect(await cache.getBalance({ address: a })).toBeUndefined();
      expect(await cache.getBalance({ address: b })).toBeUndefined();
      expect(await cache.getBlock()).toEqual({ number: 7n });
    });
  });
});
