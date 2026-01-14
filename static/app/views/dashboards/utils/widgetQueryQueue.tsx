import {createContext, useContext, useMemo, useRef} from 'react';
import {metrics} from '@sentry/react';
import {
  asyncQueuerOptions,
  useAsyncQueuer,
  type ReactAsyncQueuer,
} from '@tanstack/react-pacer';

import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';

type FetchDataFn = () => Promise<void>;

type QueueItem = {
  fetchData: FetchDataFn;
  widgetId: string;
};

export type WidgetQueryQueue = ReactAsyncQueuer<QueueItem>;

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
        onSettled: (_item: QueueItem, queuer) => {
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
    const addItem = (item: QueueItem) => {
      // Never add the same widget to the queue twice based on widgetId
      // When fetchData executes from the queue, it reads from refs to get the latest state (widget, selection, etc.)
      if (queue.peekPendingItems().some(i => i.widgetId === item.widgetId)) {
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

const fetchWidgetItem = async (item: QueueItem) => {
  const {fetchData} = item;
  const result = await fetchData();
  return result;
};
