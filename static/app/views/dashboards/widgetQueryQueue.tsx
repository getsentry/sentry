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

export type WidgetQueryQueue = ReactAsyncQueuer<QueueItem<any, any>>;

type Context = {
  queue: WidgetQueryQueue;
};

const WidgetQueueContext = createContext<Context | undefined>(undefined);

export function useWidgetQueryQueue() {
  return useContext(WidgetQueueContext) ?? {queue: undefined};
}

export function WidgetQueryQueueProvider({children}: {children: React.ReactNode}) {
  const queueOptions: AsyncQueuerOptions<QueueItem<any, any>> = {
    concurrency: 2,
    wait: 5000,
    started: true,
  };

  const queue = useAsyncQueuer<QueueItem<any, any>>(fetchWidgetItem, queueOptions);

  const context = {
    queue,
  };
  return (
    <WidgetQueueContext.Provider value={context}>{children}</WidgetQueueContext.Provider>
  );
}

const fetchWidgetItem = async (item: QueueItem<any, any>) => {
  const result = await item.widget.fetchData();
  return result;
};
