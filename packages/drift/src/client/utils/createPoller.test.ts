import { createPoller } from "src/client/utils/createPoller";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("createPoller", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("polls repeatedly until unsubscribed", async () => {
    const poll = vi.fn();
    const unsubscribe = createPoller({ poll, pollingInterval: 1000 });

    // The first poll is deferred, not run synchronously.
    expect(poll).not.toHaveBeenCalled();

    await vi.runOnlyPendingTimersAsync();
    expect(poll).toHaveBeenCalledTimes(1);

    await vi.runOnlyPendingTimersAsync();
    expect(poll).toHaveBeenCalledTimes(2);

    unsubscribe();
    await vi.runOnlyPendingTimersAsync();
    expect(poll).toHaveBeenCalledTimes(2);
  });

  it("keeps polling after an error and reports it via onError", async () => {
    const error = new Error("boom");
    const poll = vi
      .fn()
      .mockRejectedValueOnce(error)
      .mockResolvedValue(undefined);
    const onError = vi.fn();
    createPoller({ poll, pollingInterval: 1000, onError });

    await vi.runOnlyPendingTimersAsync();
    expect(onError).toHaveBeenCalledWith(error);

    await vi.runOnlyPendingTimersAsync();
    expect(poll).toHaveBeenCalledTimes(2);
  });

  it("keeps polling even if onError itself throws", async () => {
    const poll = vi.fn().mockRejectedValue(new Error("boom"));
    const onError = vi.fn(() => {
      throw new Error("onError threw");
    });
    createPoller({ poll, pollingInterval: 1000, onError });

    await vi.runOnlyPendingTimersAsync();
    expect(poll).toHaveBeenCalledTimes(1);

    // A throwing onError must not stop the poller.
    await vi.runOnlyPendingTimersAsync();
    expect(poll).toHaveBeenCalledTimes(2);
    expect(onError).toHaveBeenCalledTimes(2);
  });

  it("does not poll when unsubscribed before the first poll", async () => {
    const poll = vi.fn();
    const unsubscribe = createPoller({ poll, pollingInterval: 1000 });
    unsubscribe();

    await vi.runOnlyPendingTimersAsync();
    expect(poll).not.toHaveBeenCalled();
  });
});
