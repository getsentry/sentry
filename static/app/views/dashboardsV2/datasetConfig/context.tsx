import {ReactNode, useState} from 'react';

import {Organization} from 'sentry/types';
import {createDefinedContext} from 'sentry/utils/performance/contexts/utils';
import useOrganization from 'sentry/utils/useOrganization';

import {WidgetType} from '../types';

import {getErrorsAndTransactionsConfig} from './errorsAndTransactions';
import {IssuesConfig} from './issues';
import {ReleasesConfig} from './releases';

function createDatasetConfigContext(widgetType: WidgetType | undefined) {
  const [_DatasetConfigProvider, useDatasetConfigContext, DatasetConfigContext] =
    createDefinedContext<{datasetConfig: ReturnType<typeof getDatasetConfig>}>({
      name: 'DatasetConfigContext',
    });

  function DatasetConfigProvider({children}: {children: ReactNode}) {
    const organization = useOrganization();
    const config = getDatasetConfig(organization, widgetType);
    const [datasetConfig] = useState<typeof config>(config);

    return (
      <_DatasetConfigProvider
        value={{
          datasetConfig,
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

export function getDatasetConfig(
  organization: Organization,
  widgetType: WidgetType | undefined
) {
  switch (widgetType) {
    case WidgetType.RELEASE:
      return ReleasesConfig;
    case WidgetType.ISSUE:
      return IssuesConfig;
    case WidgetType.DISCOVER:
    default:
      return getErrorsAndTransactionsConfig(organization);
  }
}
