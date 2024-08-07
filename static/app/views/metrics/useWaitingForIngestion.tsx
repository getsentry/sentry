import {useCallback, useEffect, useMemo, useRef} from 'react';

import {useMetricsContext} from 'sentry/views/metrics/context';

const WAIT_FOR_INGESTION_TIMEOUT = 5 * 60 * 1000;

export const useWaitingForIngestion = () => {
  const {widgets, updateWidget} = useMetricsContext();

  const awaitingMetricIngestion = useMemo(() => {
    return widgets.map(widget => !!widget.awaitingMetricIngestion && !widget.isHidden);
  }, [widgets]);

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
