import type { MaybePromise } from "src/utils/types";

/**
 * The default maximum number of attempts for {@linkcode retry}.
 */
export const DEFAULT_MAX_ATTEMPTS = 3;

/**
 * The default delay strategy for {@linkcode retry}: an exponential backoff
 * starting at 100ms (100ms, 200ms, 400ms, ...).
 */
export function defaultRetryDelay(attempt: number): number {
  return 2 ** (attempt - 1) * 100;
}

export interface RetryOptions {
  /**
   * The maximum number of attempts, including the first. Values less than `1`
   * are treated as `1` (the action always runs at least once).
   *
   * @default 3
   */
  maxAttempts?: number;

  /**
   * The delay before each retry in milliseconds, or a function that returns it
   * given the (1-based) number of the attempt that just failed.
   *
   * @default
   * // exponential backoff starting at 100ms
   * (attempt) => 2 ** (attempt - 1) * 100
   */
  delay?: number | ((attempt: number) => number);

  /**
   * Called with the error and the (1-based) number of the attempt that failed
   * to decide whether to retry. Return `false` to rethrow immediately instead
   * of retrying. Defaults to always retrying until {@linkcode maxAttempts} is
   * reached.
   */
  shouldRetry?: (error: unknown, attempt: number) => MaybePromise<boolean>;
}

/**
 * Calls `action` and retries it if it throws, until it succeeds or the maximum
 * number of attempts is reached.
 *
 * @param action - The function to call. It receives the (1-based) attempt
 * number.
 * @returns The resolved value of `action`.
 * @throws The error from the final attempt if all attempts fail (or the first
 * error for which {@linkcode RetryOptions.shouldRetry shouldRetry} returns
 * `false`).
 *
 * @example
 * ```ts
 * const hash = await retry(() => drift.write({ abi, address, fn, args }), {
 *   maxAttempts: 5,
 *   shouldRetry: (error) => isTransient(error),
 * });
 * ```
 */
export async function retry<T>(
  action: (attempt: number) => MaybePromise<T>,
  {
    maxAttempts = DEFAULT_MAX_ATTEMPTS,
    delay = defaultRetryDelay,
    shouldRetry,
  }: RetryOptions = {},
): Promise<T> {
  // Always make at least one attempt.
  const attempts = maxAttempts >= 1 ? maxAttempts : 1;
  for (let attempt = 1; ; attempt++) {
    try {
      return await action(attempt);
    } catch (error) {
      const isLastAttempt = attempt >= attempts;
      if (
        isLastAttempt ||
        (shouldRetry && !(await shouldRetry(error, attempt)))
      ) {
        throw error;
      }
      try {
        const ms = typeof delay === "function" ? delay(attempt) : delay;
        if (ms > 0) {
          await new Promise((resolve) => setTimeout(resolve, ms));
        }
      } catch {
        // A broken delay strategy must not mask the action's error.
        throw error;
      }
    }
  }
}
