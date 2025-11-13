import {createContext, useContext, useMemo, useRef} from 'react';
import {metrics} from '@sentry/react';
import {
  asyncQueuerOptions,
  useAsyncQueuer,
  type ReactAsyncQueuer,
} from '@tanstack/react-pacer';

import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import type GenericWidgetQueries from 'sentry/views/dashboards/widgetCard/genericWidgetQueries';

type QueueItem<SeriesResponse, TableResponse> = {
  widgetQuery: GenericWidgetQueries<SeriesResponse, TableResponse>;
};

export type WidgetQueryQueue = ReactAsyncQueuer<QueueItem<any, any>>;

type Context = {
  queue: WidgetQueryQueue;
};

const WidgetQueueContext = createContext<Context | undefined>(undefined);

export function useWidgetQueryQueue() {
  const organization = useOrganization();
  const hasQueueFeature = organization.features.includes(
    'visibility-dashboards-async-queue'
  );
  const queueContext = useContext(WidgetQueueContext);

  return hasQueueFeature && queueContext ? queueContext : {queue: undefined};
}

// Lowest known safe values for customers
const MAX_CONCURRENCY = 5;
const MAX_RETRIES = 5;

export function WidgetQueryQueueProvider({children}: {children: React.ReactNode}) {
  const startTimeRef = useRef<number | undefined>(undefined);
  const location = useLocation();

  const queueOptions = useMemo(
    () =>
      asyncQueuerOptions({
        concurrency: MAX_CONCURRENCY,
        wait: 5,
        started: true,
        key: 'widget-query-queue',
        asyncRetryerOptions: {
          backoff: 'exponential',
          maxAttempts: MAX_RETRIES,
          onRetry: (_attempt, _error, _asyncRetryer) => {
            // TODO: Dynamically reduce concurrency
          },
        },
        onSettled: (_item: QueueItem<any, any>, queuer) => {
          const queueIsEmpty = queuer.peekAllItems().length === 0;
          if (queueIsEmpty && startTimeRef.current) {
            const endTime = performance.now();
            const totalTime = endTime - startTimeRef.current;
            startTimeRef.current = undefined;
            metrics.distribution(
              'dashboards.widget_query_queue.time_to_empty',
              totalTime,
              {
                attributes: {
                  url: location.pathname,
                },
                unit: 'millisecond',
              }
            );
          }
        },
      }),
    [location.pathname]
  );

  const queue = useAsyncQueuer(fetchWidgetItem, queueOptions);

  const context = useMemo(() => {
    const addItem = (item: QueueItem<any, any>) => {
      // Never add the same widget to the queue twice
      // even if the date selection has change `fetchData()` in `fetchWidgetItem` will still be called with the latest state.
      if (queue.peekPendingItems().some(i => i.widgetQuery === item.widgetQuery)) {
        return true;
      }
      const queueIsEmpty = queue.peekAllItems().length === 0;

      if (queueIsEmpty) {
        startTimeRef.current = performance.now();
      }

      return queue.addItem(item);
    };
    return {queue: {...queue, addItem}};
  }, [queue]);

  return (
    <WidgetQueueContext.Provider value={context}>{children}</WidgetQueueContext.Provider>
  );
}

const fetchWidgetItem = async (item: QueueItem<any, any>) => {
  const result = await item.widgetQuery.fetchData();
  return result;
};
