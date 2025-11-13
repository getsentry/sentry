// scaffold basic context provider and hook

import {createContext, useCallback, useContext, useRef} from 'react';
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
  widget: GenericWidgetQueries<SeriesResponse, TableResponse>;
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

export function WidgetQueryQueueProvider({children}: {children: React.ReactNode}) {
  const startTime = useRef<number | undefined>(undefined);
  const location = useLocation();

  const queueOptions = asyncQueuerOptions({
    concurrency: 10,
    wait: 5,
    started: true,
    key: 'widget-query-queue',
    onSettled: () => {
      const queueIsEmpty = queue.peekAllItems().length === 0;
      if (queueIsEmpty && startTime.current) {
        const endTime = performance.now();
        const totalTime = endTime - startTime.current;
        startTime.current = undefined;
        metrics.distribution('dashboards.widget_query_queue.time_to_empty', totalTime, {
          attributes: {
            url: location.pathname,
          },
          unit: 'millisecond',
        });
      }
    },
  });

  const queue = useAsyncQueuer<QueueItem<any, any>>(fetchWidgetItem, queueOptions);

  const addItem = useCallback(
    (item: QueueItem<any, any>) => {
      // Never add the same widget to the queue twice
      // even if the date selection has change fetchData() will still be called with the latest state.
      if (queue.peekPendingItems().some(i => i.widget === item.widget)) {
        return true;
      }
      const queueIsEmpty = queue.peekAllItems().length === 0;

      if (queueIsEmpty) {
        startTime.current = performance.now();
      }

      return queue.addItem(item);
    },
    [queue]
  );

  const context = {
    queue: {...queue, addItem},
  };
  return (
    <WidgetQueueContext.Provider value={context}>{children}</WidgetQueueContext.Provider>
  );
}

const fetchWidgetItem = async (item: QueueItem<any, any>) => {
  const result = await item.widget.fetchData();
  return result;
};
