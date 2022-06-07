import {ReactNode} from 'react';

import {createDefinedContext} from 'sentry/utils/performance/contexts/utils';

import {WidgetType} from '../types';

import {getDatasetConfig} from './base';

function createDatasetConfigContext(widgetType: WidgetType | undefined) {
  const config = getDatasetConfig(widgetType);
  const [_DatasetConfigProvider, useDatasetConfigContext, DatasetConfigContext] =
    createDefinedContext<{datasetConfig: typeof config}>({
      name: 'DatasetConfigContext',
    });

  function DatasetConfigProvider({children}: {children: ReactNode}) {
    return (
      <_DatasetConfigProvider
        value={{
          datasetConfig: config,
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
} = createDatasetConfigContext(WidgetType.RELEASE);

export const {
  DatasetConfigProvider: IssuesDatasetConfigProvider,
  useDatasetConfigContext: useIssuesDatasetConfigContext,
  DatasetConfigContext: IssuesDatasetConfigContext,
  DatasetConfigConsumer: IssuesDatasetConfigConsumer,
} = createDatasetConfigContext(WidgetType.ISSUE);

export const {
  DatasetConfigProvider: ErrorsAndTransactionsDatasetConfigProvider,
  useDatasetConfigContext: useErrorsAndTransactionsDatasetConfigContext,
  DatasetConfigContext: ErrorsAndTransactionsDatasetConfigContext,
  DatasetConfigConsumer: ErrorsAndTransactionsDatasetConfigConsumer,
} = createDatasetConfigContext(WidgetType.DISCOVER);

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

export function getDatasetConfigContextHook(widgetType: WidgetType | undefined) {
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
