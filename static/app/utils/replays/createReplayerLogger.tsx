import type {playerConfig} from '@sentry-internal/rrweb';

const DEFAULT_WARNING_LIMIT = 50;

/**
 * rrweb warns once per unresolved mutation and hands the whole mutation payload
 * to the console, which keeps it alive. A replay missing its initial snapshot
 * resolves nothing, so the console can retain the entire recording and take the
 * tab down with it.
 */
export function createReplayerLogger(
  warningLimit: number = DEFAULT_WARNING_LIMIT
): playerConfig['logger'] {
  let warningCount = 0;

  return {
    log: (...args) => {
      // eslint-disable-next-line no-console
      console.log(...args);
    },
    warn: (...args) => {
      warningCount += 1;

      if (warningCount <= warningLimit) {
        // eslint-disable-next-line no-console
        console.warn(...args);
        return;
      }

      if (warningCount === warningLimit + 1) {
        // eslint-disable-next-line no-console
        console.warn(
          `[replay] Suppressing further rrweb warnings after ${warningLimit}.`
        );
      }
    },
  };
}
