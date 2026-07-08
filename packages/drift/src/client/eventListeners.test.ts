import type { EventLog } from "src/adapter/types/Event";
import { createMockClient } from "src/client/MockClient";
import { randomAddress } from "src/utils/testing/randomAddress";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const erc20Abi = [
  {
    type: "event",
    name: "Transfer",
    inputs: [
      { name: "from", type: "address", indexed: true },
      { name: "to", type: "address", indexed: true },
      { name: "value", type: "uint256", indexed: false },
    ],
    anonymous: false,
  },
] as const;

const POLLING_INTERVAL = 1_000;

describe("event listeners", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  describe("onBlock", () => {
    it("fires once per new block after a baseline poll", async () => {
      const client = createMockClient();
      let currentBlock = 10n;
      client.onGetBlockNumber().callsFake(async () => currentBlock);

      const callback = vi.fn();
      const unsubscribe = client.onBlock(callback, {
        pollingInterval: POLLING_INTERVAL,
      });

      // First poll establishes the baseline without firing.
      await vi.runOnlyPendingTimersAsync();
      expect(callback).not.toHaveBeenCalled();

      // The chain advances -> fires once with the latest block number.
      currentBlock = 12n;
      await vi.runOnlyPendingTimersAsync();
      expect(callback.mock.calls).toEqual([[12n]]);

      // No change -> no new calls.
      await vi.runOnlyPendingTimersAsync();
      expect(callback).toHaveBeenCalledTimes(1);

      // Advances again -> fires with the new latest.
      currentBlock = 15n;
      await vi.runOnlyPendingTimersAsync();
      expect(callback.mock.calls).toEqual([[12n], [15n]]);

      // Unsubscribe stops polling.
      currentBlock = 20n;
      unsubscribe();
      await vi.runOnlyPendingTimersAsync();
      expect(callback).toHaveBeenCalledTimes(2);
    });

    it("does not fire if unsubscribed during an in-flight poll", async () => {
      const client = createMockClient();
      let callCount = 0;
      let resolveSecond: (blockNumber: bigint) => void = () => {};
      client.onGetBlockNumber().callsFake(() => {
        // First call (baseline) resolves immediately; the second one hangs so
        // we can unsubscribe while it's in flight.
        if (callCount++ === 0) return Promise.resolve(10n);
        return new Promise<bigint>((resolve) => {
          resolveSecond = resolve;
        });
      });

      const callback = vi.fn();
      const unsubscribe = client.onBlock(callback, {
        pollingInterval: POLLING_INTERVAL,
      });

      await vi.runOnlyPendingTimersAsync(); // baseline poll (10n)
      vi.runOnlyPendingTimers(); // start the second poll (getBlockNumber hangs)

      unsubscribe(); // unsubscribe while the poll is in flight
      resolveSecond(20n); // the pending fetch now resolves
      await vi.runOnlyPendingTimersAsync();

      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe("onEvent", () => {
    it("fires with new events for the polled block range", async () => {
      const client = createMockClient();
      const address = randomAddress();
      let currentBlock = 10n;
      client.onGetBlockNumber().callsFake(async () => currentBlock);

      const transfer = {
        eventName: "Transfer",
        args: { from: randomAddress(), to: randomAddress(), value: 1n },
        address,
        blockNumber: 12n,
      } as unknown as EventLog<typeof erc20Abi, "Transfer">;

      const getEventsCalls: any[] = [];
      client.onGetEvents({ address }).callsFake(async (params: any) => {
        getEventsCalls.push(params);
        return [transfer] as any;
      });

      const callback = vi.fn();
      const unsubscribe = client.onEvent(
        { abi: erc20Abi, address, event: "Transfer" },
        callback,
        { pollingInterval: POLLING_INTERVAL },
      );

      // First poll: baseline, no fetch (no new blocks yet).
      await vi.runOnlyPendingTimersAsync();
      expect(callback).not.toHaveBeenCalled();
      expect(getEventsCalls).toHaveLength(0);

      // New blocks -> fetch [11, 12] and deliver events.
      currentBlock = 12n;
      await vi.runOnlyPendingTimersAsync();
      expect(callback).toHaveBeenCalledWith([transfer]);
      expect(getEventsCalls.at(-1)).toMatchObject({
        address,
        event: "Transfer",
        fromBlock: 11n,
        toBlock: 12n,
      });

      unsubscribe();
    });

    it("does not fire when no events are returned", async () => {
      const client = createMockClient();
      const address = randomAddress();
      let currentBlock = 5n;
      client.onGetBlockNumber().callsFake(async () => currentBlock);
      client.onGetEvents({ address }).callsFake(async () => []);

      const callback = vi.fn();
      client.onEvent({ abi: erc20Abi, address, event: "Transfer" }, callback, {
        pollingInterval: POLLING_INTERVAL,
      });

      await vi.runOnlyPendingTimersAsync();
      currentBlock = 8n;
      await vi.runOnlyPendingTimersAsync();
      expect(callback).not.toHaveBeenCalled();
    });

    it("includes historical events when fromBlock is provided", async () => {
      const client = createMockClient();
      const address = randomAddress();
      client.onGetBlockNumber().callsFake(async () => 100n);

      const getEventsCalls: any[] = [];
      client.onGetEvents({ address }).callsFake(async (params: any) => {
        getEventsCalls.push(params);
        return [];
      });

      client.onEvent(
        { abi: erc20Abi, address, event: "Transfer", fromBlock: 50n },
        vi.fn(),
        { pollingInterval: POLLING_INTERVAL },
      );

      // First poll fetches [50, 100] because fromBlock was provided.
      await vi.runOnlyPendingTimersAsync();
      expect(getEventsCalls.at(-1)).toMatchObject({
        fromBlock: 50n,
        toBlock: 100n,
      });
    });
  });

  describe("onSignerChange", () => {
    it("fires only when the signer changes", async () => {
      const client = createMockClient();
      let signer: `0x${string}` = "0x1111111111111111111111111111111111111111";
      client.onGetSignerAddress().callsFake(async () => signer);

      const callback = vi.fn();
      client.onSignerChange(callback, { pollingInterval: POLLING_INTERVAL });

      // Baseline poll, no fire.
      await vi.runOnlyPendingTimersAsync();
      expect(callback).not.toHaveBeenCalled();

      // Same signer, no fire.
      await vi.runOnlyPendingTimersAsync();
      expect(callback).not.toHaveBeenCalled();

      // Changed signer, fires with the new address.
      signer = "0x2222222222222222222222222222222222222222";
      await vi.runOnlyPendingTimersAsync();
      expect(callback).toHaveBeenCalledExactlyOnceWith(signer);
    });

    it("throws without a signer", () => {
      const client = createMockClient();
      (client.adapter as any).getSignerAddress = undefined;
      expect(() => client.onSignerChange(vi.fn())).toThrowError(/signer/i);
    });
  });
});
