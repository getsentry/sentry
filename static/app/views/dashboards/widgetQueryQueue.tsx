// scaffold basic context provider and hook

import {createContext, useContext} from 'react';
import {
  useAsyncQueuer,
  type AsyncQueuerOptions,
  type ReactAsyncQueuer,
} from '@tanstack/react-pacer';

import type GenericWidgetQueries from 'sentry/views/dashboards/widgetCard/genericWidgetQueries';

export type QueueItem<SeriesResponse, TableResponse> = {
  widget: GenericWidgetQueries<SeriesResponse, TableResponse>;
};

type Context = {
  queue: ReactAsyncQueuer<QueueItem<unknown, unknown>>;
};

const WidgetQueueContext = createContext<Context | undefined>(undefined);

export function useWidgetQueryQueue() {
  return useContext(WidgetQueueContext);
}

export function WidgetQueryQueueProvider({children}: {children: React.ReactNode}) {
  const queueOptions: AsyncQueuerOptions<QueueItem<unknown, unknown>> = {
    concurrency: 2,
    wait: 5000,
    started: true,
  };

  const queue = useAsyncQueuer<QueueItem<unknown, unknown>>(
    fetchWidgetItem,
    queueOptions
  );

  const context = {
    queue,
  };
  return (
    <WidgetQueueContext.Provider value={context}>{children}</WidgetQueueContext.Provider>
  );
}

const fetchWidgetItem = async (item: QueueItem<unknown, unknown>) => {
  const result = await item.widget.fetchData();
  return result;
};
