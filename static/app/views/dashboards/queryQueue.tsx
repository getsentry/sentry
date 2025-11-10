// scaffold basic context provider and hook

import {createContext, useContext} from 'react';
import {AsyncQueuer} from '@tanstack/pacer';

import type GenericWidgetQueries from 'sentry/views/dashboards/widgetCard/genericWidgetQueries';

export type QueueItem<SeriesResponse, TableResponse> = {
  widget: GenericWidgetQueries<SeriesResponse, TableResponse>;
};

type Context = {
  queue: AsyncQueuer<QueueItem<unknown, unknown>>;
};

const QueueContext = createContext<Context | undefined>(undefined);

export function useQueryQueue() {
  return useContext(QueueContext);
}

export function QueryQueueProvider({children}: {children: React.ReactNode}) {
  const queue = new AsyncQueuer<QueueItem<unknown, unknown>>(fetchWidgetItem, {
    // TODO: Change these values, these are just for testing that it's working
    concurrency: 1,
    wait: 5000,
    started: true,
  });

  // queue.setOptions({
  //   onSuccess: (item: number) => {
  //     console.log('Item processed:', item);
  //   },
  // });

  const context = {
    queue,
  };
  return <QueueContext.Provider value={context}>{children}</QueueContext.Provider>;
}

const fetchWidgetItem = async (item: QueueItem<unknown, unknown>) => {
  await item.widget.fetchData();
};
