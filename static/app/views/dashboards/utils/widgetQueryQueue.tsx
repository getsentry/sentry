import type {RefObject} from 'react';
import {createContext, useContext, useMemo, useRef} from 'react';
import {metrics} from '@sentry/react';
import {
  asyncQueuerOptions,
  useAsyncQueuer,
  type ReactAsyncQueuer,
} from '@tanstack/react-pacer';
import type {QueryFunctionContext} from '@tanstack/react-query';

import {apiFetch, type ApiResponse} from 'sentry/utils/api/apiFetch';
import type {ApiQueryKey} from 'sentry/utils/api/apiQueryKey';
import {RequestError} from 'sentry/utils/requestError/requestError';
import {useLocation} from 'sentry/utils/useLocation';
import {useOrganization} from 'sentry/utils/useOrganization';

type FetchDataFn = () => Promise<void>;

type QueueItem = {
  fetchDataRef: RefObject<FetchDataFn>;
};

type WidgetQueryQueue = ReactAsyncQueuer<QueueItem>;

type Context = {
  queue: WidgetQueryQueue;
};

const WidgetQueueContext = createContext<Context | undefined>(undefined);

export function useWidgetQueryQueue() {
  const queueContext = useContext(WidgetQueueContext);

  return queueContext ? queueContext : {queue: undefined};
}

// HTTP status of a failed widget request, for metric attributes. Rate limited
// requests (429) are the main thing worth separating from other failures.
function getErrorStatus(error: unknown): string {
  return error instanceof RequestError && error.status ? String(error.status) : 'unknown';
}

// The query key holds the resolved URL, so swap the org slug for a placeholder to
// keep the metric attribute low cardinality
function getEndpointForMetrics(url: string): string {
  return url.replace(/^\/organizations\/[^/]+\//, '/organizations/{org}/');
}

/**
 * Fetches a widget query through the widget query queue when one is available,
 * otherwise fetches it directly. Failures are counted with their HTTP status and
 * endpoint so rate limiting and other errors show up in metrics.
 *
 * Note that the queue never sees the failure: the request promise is settled
 * here, so the queue's retryer only ever observes a resolved task.
 */
export function queueApiFetch<TResponseData>(
  queue: WidgetQueryQueue | undefined,
  context: QueryFunctionContext<ApiQueryKey>
): Promise<ApiResponse<TResponseData>> {
  const [url] = context.queryKey;
  const trackFailure = (error: unknown) => {
    metrics.count('dashboards.widget_query.failed', 1, {
      attributes: {endpoint: getEndpointForMetrics(url), status: getErrorStatus(error)},
    });
  };

  if (!queue) {
    return apiFetch<TResponseData>(context).catch(error => {
      trackFailure(error);
      throw error;
    });
  }

  return new Promise((resolve, reject) => {
    const fetchDataRef = {
      current: () =>
        apiFetch<TResponseData>(context).then(resolve, error => {
          trackFailure(error);
          reject(error);
        }),
    };
    queue.addItem({fetchDataRef});
  });
}

// Lowest known safe value for customers — used when the org option is unset so we
// never accidentally assume a high limit.
const FALLBACK_CONCURRENCY = 5;
const MAX_RETRIES = 5;

export function WidgetQueryQueueProvider({children}: {children: React.ReactNode}) {
  const startTimeRef = useRef<number | undefined>(undefined);
  const location = useLocation();
  const organization = useOrganization();
  const concurrency =
    organization.dashboardsAsyncQueueParallelLimit ?? FALLBACK_CONCURRENCY;

  const queueOptions = useMemo(
    () =>
      asyncQueuerOptions({
        concurrency,
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
            // oxlint-disable-next-line react/purity
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
    [location.pathname, concurrency]
  );

  const queue = useAsyncQueuer(fetchWidgetItem, queueOptions);

  const context = useMemo(() => {
    const addItem = (item: QueueItem) => {
      // Never add the same component instance to the queue twice based on fetchDataRef
      // Each component instance has its own fetchDataRef, so this deduplicates per-instance
      // When the queue executes, it calls fetchDataRef.current which always points to the latest fetchData function
      if (queue.peekPendingItems().some(i => i.fetchDataRef === item.fetchDataRef)) {
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
  // Call the function from the ref - this always gets the latest version with current props
  const result = await item.fetchDataRef.current();
  return result;
};
