import { MockAdapter } from "src/adapter/MockAdapter";
import { createStubEvents } from "src/adapter/utils/testing/createStubEvent";
import { TestToken } from "src/artifacts/TestToken";
import { createContract } from "src/client/contract/Contract";
import { ALICE, BOB } from "src/utils/testing/accounts";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const abi = TestToken.abi;
const address = "0xAddress";
const adapter = new MockAdapter();
adapter.onGetChainId().resolves(0);

describe("Contract", () => {
  describe("getEvents", () => {
    describe("epochBlock", () => {
      const event = "Transfer";
      const epochBlock = 123n;
      const eventsAtEpoch = createStubEvents({
        abi,
        eventName: event,
        events: [{ args: { from: ALICE, to: BOB, value: 123n } }],
      });

      it("is used by default if defined", async () => {
        adapter.onGetEvents({ abi, address, event }).resolves([]);
        adapter
          .onGetEvents({ abi, address, event, fromBlock: epochBlock })
          .resolves(eventsAtEpoch);

        const contract = createContract({ abi, address, adapter, epochBlock });
        const returnedEvents = await contract.getEvents(event);

        expect(returnedEvents).toBe(eventsAtEpoch);
      });

      it("is used in place of 'earliest' if defined", async () => {
        adapter
          .onGetEvents({ abi, address, event, fromBlock: "earliest" })
          .resolves([]);
        adapter
          .onGetEvents({ abi, address, event, fromBlock: epochBlock })
          .resolves(eventsAtEpoch);

        const contract = createContract({ abi, address, adapter, epochBlock });
        const returnedEvents = await contract.getEvents(event, {
          fromBlock: "earliest",
        });

        expect(returnedEvents).toBe(eventsAtEpoch);
      });

      it("is used in place of lower block numbers if defined", async () => {
        adapter
          .onGetEvents({ abi, address, event, fromBlock: 0n })
          .resolves([]);
        adapter
          .onGetEvents({ abi, address, event, fromBlock: epochBlock })
          .resolves(eventsAtEpoch);

        const contract = createContract({ abi, address, adapter, epochBlock });
        const returnedEvents = await contract.getEvents(event, {
          fromBlock: 0n,
        });

        expect(returnedEvents).toBe(eventsAtEpoch);
      });
    });
  });

  describe("onEvent", () => {
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => vi.useRealTimers());

    it("polls and fires with new events, applying epochBlock", async () => {
      const event = "Transfer";
      const epochBlock = 123n;
      const events = createStubEvents({
        abi,
        eventName: event,
        events: [{ args: { from: ALICE, to: BOB, value: 1n } }],
      });

      const onEventAdapter = new MockAdapter();
      onEventAdapter.onGetChainId().resolves(0);
      onEventAdapter.onGetBlockNumber().callsFake(async () => 200n);
      const getEventsCalls: any[] = [];
      onEventAdapter
        .onGetEvents({ abi, address, event })
        .callsFake(async (params: any) => {
          getEventsCalls.push(params);
          return events;
        });

      const contract = createContract({
        abi,
        address,
        adapter: onEventAdapter,
        epochBlock,
      });
      const callback = vi.fn();
      const unsubscribe = contract.onEvent(event, callback, {
        pollingInterval: 1_000,
      });

      // First poll uses the contract's epochBlock as fromBlock.
      await vi.runOnlyPendingTimersAsync();
      expect(callback).toHaveBeenCalledWith(events);
      expect(getEventsCalls.at(-1)).toMatchObject({
        abi,
        address,
        event,
        fromBlock: epochBlock,
        toBlock: 200n,
      });

      unsubscribe();
    });
  });

  it("maintains hooks proxy when extending", async () => {
    const contract = createContract({ abi, address, adapter }).extend({
      foo() {},
    });
    const beforeHandler = vi.fn(async ({ resolve }) => resolve());
    const afterHandler = vi.fn();

    contract.client.hooks.on("before:read", beforeHandler);
    contract.client.hooks.on("after:read", afterHandler);
    await contract.read("symbol");

    expect(beforeHandler).toHaveBeenCalledTimes(1);
    expect(afterHandler).toHaveBeenCalledTimes(1);
  });
});
