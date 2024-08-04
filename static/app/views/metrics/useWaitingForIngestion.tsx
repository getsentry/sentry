import {useCallback, useEffect, useRef} from 'react';

import type {MetricsWidget} from 'sentry/utils/metrics/types';

const WAIT_FOR_INGESTION_TIMEOUT = 5 * 60 * 1000;

export const useWaitingForIngestion = (
  widgets: MetricsWidget[],
  updateWidget: (index: number, data: Partial<Omit<MetricsWidget, 'type'>>) => void
) => {
  const awaitingMetricIngestion = widgets.map(widget => !!widget.awaitingMetricIngestion);
  const timeoutsRef = useRef<(NodeJS.Timeout | undefined)[]>(
    awaitingMetricIngestion.map(() => undefined)
  );

  const handleEndAwaitingMetricIngestion = useCallback(
    (index: number) => {
      if (awaitingMetricIngestion[index]) {
        updateWidget(index, {awaitingMetricIngestion: false});
      }
    },
    [updateWidget, awaitingMetricIngestion]
  );

  useEffect(() => {
    const timeouts = timeoutsRef.current;

    awaitingMetricIngestion.forEach((awaitsIngestion, index) => {
      if (awaitsIngestion && !timeouts[index]) {
        timeouts[index] = setTimeout(() => {
          handleEndAwaitingMetricIngestion(index);
        }, WAIT_FOR_INGESTION_TIMEOUT);
      } else if (!awaitsIngestion && timeouts[index]) {
        clearTimeout(timeouts[index]);
        timeouts[index] = undefined;
      }
    });
  }, [awaitingMetricIngestion, handleEndAwaitingMetricIngestion]);

  return {
    awaitingMetricIngestion,
    endAwaitingMetricIngestion: handleEndAwaitingMetricIngestion,
  };
};
