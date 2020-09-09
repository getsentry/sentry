import {timestampWithMs} from '@sentry/utils';

import getCurrentSentryReactTransaction from './getCurrentSentryReactTransaction';

const MIN_UPDATE_SPAN_TIME = 10;

/**
 * Callback for React Profiler https://reactjs.org/docs/profiler.html
 */
export function onRenderCallback(
  id: string,
  phase: 'mount' | 'update',
  actualDuration: number
) {
  const transaction = getCurrentSentryReactTransaction();
  if (transaction && actualDuration > MIN_UPDATE_SPAN_TIME) {
    const now = timestampWithMs();
    const span = transaction.startChild({
      description: `<${id}>`,
      op: `react.${phase}`,
      startTimestamp: now - actualDuration / 1000,
      endTimestamp: now,
    });
    span.finish();
  }
}
