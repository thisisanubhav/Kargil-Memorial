export interface RetryOptions {
  /** Total attempts including the first one. */
  attempts?: number;
  /** Delay before the first retry; doubles on each subsequent retry. */
  baseDelayMs?: number;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

/**
 * Runs an async task with exponential-backoff retries. Rejects with the
 * last error once all attempts are exhausted.
 */
export async function withRetry<T>(
  task: () => Promise<T>,
  { attempts = 3, baseDelayMs = 600 }: RetryOptions = {},
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      return await task();
    } catch (error) {
      lastError = error;
      if (attempt < attempts - 1) {
        await delay(baseDelayMs * 2 ** attempt);
      }
    }
  }
  throw lastError;
}
