import { defaultRetryDelay, retry } from "src/utils/retry";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("retry", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("returns the result without retrying on success", async () => {
    const action = vi.fn().mockResolvedValue("ok");
    await expect(retry(action)).resolves.toBe("ok");
    expect(action).toHaveBeenCalledTimes(1);
  });

  it("retries until it succeeds", async () => {
    const action = vi
      .fn()
      .mockRejectedValueOnce(new Error("1"))
      .mockRejectedValueOnce(new Error("2"))
      .mockResolvedValue("ok");

    const promise = retry(action, { maxAttempts: 5, delay: 10 });
    await vi.runAllTimersAsync();

    await expect(promise).resolves.toBe("ok");
    expect(action).toHaveBeenCalledTimes(3);
  });

  it("throws the last error after exhausting attempts", async () => {
    const error = new Error("boom");
    const action = vi.fn().mockRejectedValue(error);

    const promise = retry(action, { maxAttempts: 3, delay: 10 });
    const assertion = expect(promise).rejects.toBe(error);
    await vi.runAllTimersAsync();
    await assertion;

    expect(action).toHaveBeenCalledTimes(3);
  });

  it("does not retry when maxAttempts is 1", async () => {
    const error = new Error("boom");
    const action = vi.fn().mockRejectedValue(error);
    await expect(retry(action, { maxAttempts: 1 })).rejects.toBe(error);
    expect(action).toHaveBeenCalledTimes(1);
  });

  it("runs at least once for maxAttempts < 1", async () => {
    const error = new Error("boom");
    for (const maxAttempts of [0, -5]) {
      const action = vi.fn().mockRejectedValue(error);
      await expect(retry(action, { maxAttempts })).rejects.toBe(error);
      expect(action).toHaveBeenCalledTimes(1);
    }
  });

  it("rethrows the original error if the delay strategy throws", async () => {
    const original = new Error("original");
    const action = vi.fn().mockRejectedValue(original);
    const delay = () => {
      throw new Error("bad delay");
    };
    // The delay error must not mask the real failure.
    await expect(retry(action, { delay })).rejects.toBe(original);
    expect(action).toHaveBeenCalledTimes(1);
  });

  it("passes the 1-based attempt number to the action", async () => {
    const attempts: number[] = [];
    const action = vi.fn((attempt: number) => {
      attempts.push(attempt);
      if (attempt < 3) throw new Error("retry");
      return "ok";
    });

    const promise = retry(action, { delay: 0 });
    await vi.runAllTimersAsync();

    await expect(promise).resolves.toBe("ok");
    expect(attempts).toEqual([1, 2, 3]);
  });

  it("computes the delay from the failed attempt number", async () => {
    const action = vi
      .fn()
      .mockRejectedValueOnce(new Error("1"))
      .mockRejectedValueOnce(new Error("2"))
      .mockResolvedValue("ok");
    const delay = vi.fn((attempt: number) => attempt * 10);

    const promise = retry(action, { delay, maxAttempts: 5 });
    await vi.runAllTimersAsync();

    await expect(promise).resolves.toBe("ok");
    expect(delay).toHaveBeenNthCalledWith(1, 1);
    expect(delay).toHaveBeenNthCalledWith(2, 2);
  });

  describe("shouldRetry", () => {
    it("rethrows immediately when it returns false", async () => {
      const error = new Error("fatal");
      const action = vi.fn().mockRejectedValue(error);
      const shouldRetry = vi.fn().mockReturnValue(false);

      await expect(retry(action, { shouldRetry })).rejects.toBe(error);
      expect(action).toHaveBeenCalledTimes(1);
      expect(shouldRetry).toHaveBeenCalledWith(error, 1);
    });

    it("keeps retrying while it returns true (and is awaited)", async () => {
      const action = vi
        .fn()
        .mockRejectedValueOnce(new Error("1"))
        .mockResolvedValue("ok");
      const shouldRetry = vi.fn().mockResolvedValue(true);

      const promise = retry(action, { delay: 0, shouldRetry });
      await vi.runAllTimersAsync();

      await expect(promise).resolves.toBe("ok");
      expect(shouldRetry).toHaveBeenCalledTimes(1);
    });

    it("is not called on the final attempt", async () => {
      const action = vi.fn().mockRejectedValue(new Error("boom"));
      const shouldRetry = vi.fn().mockReturnValue(true);

      const promise = retry(action, { maxAttempts: 2, delay: 0, shouldRetry });
      const assertion = expect(promise).rejects.toThrow("boom");
      await vi.runAllTimersAsync();
      await assertion;

      // Called after attempt 1, but not after the final attempt 2.
      expect(shouldRetry).toHaveBeenCalledTimes(1);
    });
  });

  it("defaultRetryDelay grows exponentially from 100ms", () => {
    expect(defaultRetryDelay(1)).toBe(100);
    expect(defaultRetryDelay(2)).toBe(200);
    expect(defaultRetryDelay(3)).toBe(400);
  });
});
