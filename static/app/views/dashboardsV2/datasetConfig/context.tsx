import {ReactNode, useState} from 'react';

import {
  EventsStats,
  Group,
  MetricsApiResponse,
  MultiSeriesEventsStats,
  SessionApiResponse,
} from 'sentry/types';
import {EventsTableData, TableData} from 'sentry/utils/discover/discoverQuery';
import {createDefinedContext} from 'sentry/utils/performance/contexts/utils';

import {WidgetType} from '../types';

import {DatasetConfig} from './base';

interface DatasetConfigContextInterface<SeriesResponse, TableResponse> {
  setDatasetConfig: (value?: DatasetConfig<SeriesResponse, TableResponse>) => void;
  datasetConfig?: DatasetConfig<SeriesResponse, TableResponse>;
}

function createDatasetConfigContext<SeriesResponse, TableResponse>() {
  const [_DatasetConfigProvider, useDatasetConfigContext, DatasetConfigContext] =
    createDefinedContext<DatasetConfigContextInterface<SeriesResponse, TableResponse>>({
      name: 'DatasetConfigContext',
    });

  function DatasetConfigProvider({children}: {children: ReactNode}) {
    const [datasetConfig, setDatasetConfig] = useState<
      DatasetConfig<SeriesResponse, TableResponse> | undefined
    >(undefined); // undefined means not initialized

    return (
      <_DatasetConfigProvider
        value={{
          datasetConfig,
          setDatasetConfig,
        }}
      >
        {children}
      </_DatasetConfigProvider>
    );
  }
  const DatasetConfigConsumer = DatasetConfigContext.Consumer;

  return {
    DatasetConfigProvider,
    useDatasetConfigContext,
    DatasetConfigContext,
    DatasetConfigConsumer,
  };
}

export const {
  DatasetConfigProvider: ReleasesDatasetConfigProvider,
  useDatasetConfigContext: useReleasesDatasetConfigContext,
  DatasetConfigContext: ReleasesDatasetConfigContext,
  DatasetConfigConsumer: ReleasesDatasetConfigConsumer,
} = createDatasetConfigContext<
  SessionApiResponse | MetricsApiResponse,
  SessionApiResponse | MetricsApiResponse
>();

export const {
  DatasetConfigProvider: IssuesDatasetConfigProvider,
  useDatasetConfigContext: useIssuesDatasetConfigContext,
  DatasetConfigContext: IssuesDatasetConfigContext,
  DatasetConfigConsumer: IssuesDatasetConfigConsumer,
} = createDatasetConfigContext<never, Group[]>();

export const {
  DatasetConfigProvider: ErrorsAndTransactionsDatasetConfigProvider,
  useDatasetConfigContext: useErrorsAndTransactionsDatasetConfigContext,
  DatasetConfigContext: ErrorsAndTransactionsDatasetConfigContext,
  DatasetConfigConsumer: ErrorsAndTransactionsDatasetConfigConsumer,
} = createDatasetConfigContext<
  EventsStats | MultiSeriesEventsStats,
  TableData | EventsTableData
>();

export function getDatasetConfigProvider(widgetType: WidgetType | undefined) {
  switch (widgetType) {
    case WidgetType.RELEASE:
      return ReleasesDatasetConfigProvider;
    case WidgetType.ISSUE:
      return IssuesDatasetConfigProvider;
    case WidgetType.DISCOVER:
    default:
      return ErrorsAndTransactionsDatasetConfigProvider;
  }
}

export function getDatasetConfigContext(widgetType: WidgetType | undefined) {
  switch (widgetType) {
    case WidgetType.RELEASE:
      return ReleasesDatasetConfigContext;
    case WidgetType.ISSUE:
      return IssuesDatasetConfigContext;
    case WidgetType.DISCOVER:
    default:
      return ErrorsAndTransactionsDatasetConfigContext;
  }
}

export function getDatasetConfigConsumer(widgetType: WidgetType | undefined) {
  switch (widgetType) {
    case WidgetType.RELEASE:
      return ReleasesDatasetConfigConsumer;
    case WidgetType.ISSUE:
      return IssuesDatasetConfigConsumer;
    case WidgetType.DISCOVER:
    default:
      return ErrorsAndTransactionsDatasetConfigConsumer;
  }
}

export function getDefinedContext(widgetType: WidgetType | undefined) {
  switch (widgetType) {
    case WidgetType.RELEASE:
      return useReleasesDatasetConfigContext;
    case WidgetType.ISSUE:
      return useIssuesDatasetConfigContext;
    case WidgetType.DISCOVER:
    default:
      return useErrorsAndTransactionsDatasetConfigContext;
  }
}
