import {WidgetType} from '../types';

import {
  ErrorsAndTransactionsDatasetConfigConsumer,
  ErrorsAndTransactionsDatasetConfigContext,
  ErrorsAndTransactionsDatasetConfigProvider,
  IssuesDatasetConfigConsumer,
  IssuesDatasetConfigContext,
  IssuesDatasetConfigProvider,
  ReleasesDatasetConfigConsumer,
  ReleasesDatasetConfigContext,
  ReleasesDatasetConfigProvider,
  useErrorsAndTransactionsDatasetConfigContext,
  useIssuesDatasetConfigContext,
  useReleasesDatasetConfigContext,
} from '.';

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
