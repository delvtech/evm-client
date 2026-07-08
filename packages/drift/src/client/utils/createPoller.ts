import type { MaybePromise } from "src/utils/types";

/**
 * The default polling interval, in milliseconds, used by event listeners when
 * neither the listener options nor the adapter specify one.
 */
export const DEFAULT_POLLING_INTERVAL = 4_000;

/**
 * A function that stops an event listener when called.
 */
export type Unsubscribe = () => void;

/**
 * Common options for event listeners that poll for changes.
 */
export interface EventListenerOptions {
  /**
   * How often to poll for changes, in milliseconds. Defaults to the adapter's
   * `pollingInterval` if set, otherwise {@linkcode DEFAULT_POLLING_INTERVAL}.
   */
  pollingInterval?: number;

  /**
   * Called with the error if a poll throws. The listener keeps polling. If
   * omitted, poll errors are ignored.
   */
  onError?: (error: unknown) => void;
}

/**
 * Repeatedly runs `poll` on an interval until the returned
 * {@linkcode Unsubscribe} function is called.
 *
 * A recursive timeout is used rather than `setInterval` so that polls never
 * overlap: the next poll is only scheduled once the previous one settles.
 *
 * @returns A function that stops the poller.
 */
export function createPoller({
  poll,
  pollingInterval = DEFAULT_POLLING_INTERVAL,
  onError,
}: {
  /**
   * The function to run on each poll.
   */
  poll: () => MaybePromise<void>;
} & EventListenerOptions): Unsubscribe {
  let active = true;
  let timeout: ReturnType<typeof setTimeout> | undefined;

  const tick = async (): Promise<void> => {
    if (!active) return;
    try {
      await poll();
    } catch (error) {
      // Never let a poll error, or a throwing `onError`, stop the poller.
      try {
        onError?.(error);
      } catch {}
    } finally {
      // Reschedule in `finally` so the next poll is always queued, even if
      // something above threw.
      if (active) {
        timeout = setTimeout(tick, pollingInterval);
      }
    }
  };

  // Defer the first poll so the caller receives the unsubscribe function before
  // any callback can fire, and so `setTimeout` drives every iteration (which
  // keeps behavior predictable under fake timers in tests).
  timeout = setTimeout(tick, 0);

  return () => {
    active = false;
    if (timeout !== undefined) {
      clearTimeout(timeout);
      timeout = undefined;
    }
  };
}
