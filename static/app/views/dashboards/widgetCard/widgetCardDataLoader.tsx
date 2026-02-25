import {Fragment} from 'react';

import type {PageFilters} from 'sentry/types/core';
import type {Series} from 'sentry/types/echarts';
import type {Confidence} from 'sentry/types/organization';
import type {TableDataWithTitle} from 'sentry/utils/discover/discoverQuery';
import type {AggregationOutputType, DataUnit} from 'sentry/utils/discover/fields';
import type {DashboardFilters, Widget} from 'sentry/views/dashboards/types';
import {WidgetType} from 'sentry/views/dashboards/types';
import {widgetFetchesOwnData} from 'sentry/views/dashboards/utils';
import {shouldForceQueryToSpans} from 'sentry/views/dashboards/utils/shouldForceQueryToSpans';
import SpansWidgetQueries from 'sentry/views/dashboards/widgetCard/spansWidgetQueries';
import TraceMetricsWidgetQueries from 'sentry/views/dashboards/widgetCard/traceMetricsWidgetQueries';

import IssueWidgetQueries from './issueWidgetQueries';
import MobileAppSizeWidgetQueries from './mobileAppSizeWidgetQueries';
import ReleaseWidgetQueries from './releaseWidgetQueries';
import WidgetQueries from './widgetQueries';

type Results = {
  loading: boolean;
  confidence?: Confidence;
  errorMessage?: string;
  isProgressivelyLoading?: boolean;
  isSampled?: boolean | null;
  pageLinks?: string;
  sampleCount?: number;
  tableResults?: TableDataWithTitle[];
  timeseriesResults?: Series[];
  timeseriesResultsTypes?: Record<string, AggregationOutputType>;
  timeseriesResultsUnits?: Record<string, DataUnit>;
  totalIssuesCount?: string;
};

type Props = {
  children: (props: Results) => React.ReactNode;
  selection: PageFilters;
  widget: Widget;
  dashboardFilters?: DashboardFilters;
  onDataFetchStart?: () => void;
  onDataFetched?: (
    results: Pick<
      Results,
      | 'pageLinks'
      | 'tableResults'
      | 'timeseriesResults'
      | 'timeseriesResultsTypes'
      | 'totalIssuesCount'
      | 'confidence'
      | 'sampleCount'
    >
  ) => void;
  onWidgetSplitDecision?: (splitDecision: WidgetType) => void;
  tableItemLimit?: number;
  widgetInterval?: string;
};

export function WidgetCardDataLoader({
  children,
  widget,
  selection,
  dashboardFilters,
  tableItemLimit,
  onDataFetched,
  onWidgetSplitDecision,
  onDataFetchStart,
  widgetInterval,
}: Props) {
  if (widgetFetchesOwnData(widget.displayType)) {
    return children({loading: false});
  }

  if (widget.widgetType === WidgetType.ISSUE) {
    return (
      <IssueWidgetQueries
        widget={widget}
        selection={selection}
        limit={tableItemLimit}
        onDataFetched={onDataFetched}
        dashboardFilters={dashboardFilters}
        onDataFetchStart={onDataFetchStart}
        widgetInterval={widgetInterval}
      >
        {({
          tableResults,
          timeseriesResults,
          timeseriesResultsTypes,
          errorMessage,
          loading,
        }) => (
          <Fragment>
            {children({
              tableResults,
              timeseriesResults,
              timeseriesResultsTypes,
              errorMessage,
              loading,
            })}
          </Fragment>
        )}
      </IssueWidgetQueries>
    );
  }

  if (widget.widgetType === WidgetType.RELEASE) {
    return (
      <ReleaseWidgetQueries
        widget={widget}
        selection={selection}
        limit={tableItemLimit}
        onDataFetched={onDataFetched}
        dashboardFilters={dashboardFilters}
        onDataFetchStart={onDataFetchStart}
        widgetInterval={widgetInterval}
      >
        {({tableResults, timeseriesResults, errorMessage, loading}) => (
          <Fragment>
            {children({tableResults, timeseriesResults, errorMessage, loading})}
          </Fragment>
        )}
      </ReleaseWidgetQueries>
    );
  }

  if (widget.widgetType === WidgetType.SPANS || shouldForceQueryToSpans(widget)) {
    return (
      <SpansWidgetQueries
        widget={widget}
        selection={selection}
        limit={tableItemLimit}
        onDataFetched={onDataFetched}
        dashboardFilters={dashboardFilters}
        onDataFetchStart={onDataFetchStart}
        widgetInterval={widgetInterval}
      >
        {props => <Fragment>{children({...props})}</Fragment>}
      </SpansWidgetQueries>
    );
  }

  if (widget.widgetType === WidgetType.TRACEMETRICS) {
    return (
      <TraceMetricsWidgetQueries
        widget={widget}
        selection={selection}
        limit={tableItemLimit}
        onDataFetchStart={onDataFetchStart}
        onDataFetched={onDataFetched}
        dashboardFilters={dashboardFilters}
        widgetInterval={widgetInterval}
      >
        {props => <Fragment>{children({...props})}</Fragment>}
      </TraceMetricsWidgetQueries>
    );
  }

  if (widget.widgetType === WidgetType.PREPROD_APP_SIZE) {
    return (
      <MobileAppSizeWidgetQueries
        widget={widget}
        selection={selection}
        dashboardFilters={dashboardFilters}
        widgetInterval={widgetInterval}
      >
        {props => <Fragment>{children({...props})}</Fragment>}
      </MobileAppSizeWidgetQueries>
    );
  }

  return (
    <WidgetQueries
      widget={widget}
      selection={selection}
      limit={tableItemLimit}
      onDataFetched={onDataFetched}
      onDataFetchStart={onDataFetchStart}
      dashboardFilters={dashboardFilters}
      onWidgetSplitDecision={onWidgetSplitDecision}
      widgetInterval={widgetInterval}
    >
      {({
        tableResults,
        timeseriesResults,
        errorMessage,
        loading,
        timeseriesResultsTypes,
        timeseriesResultsUnits,
        confidence,
      }) => (
        <Fragment>
          {children({
            tableResults,
            timeseriesResults,
            errorMessage,
            loading,
            timeseriesResultsTypes,
            timeseriesResultsUnits,
            confidence,
          })}
        </Fragment>
      )}
    </WidgetQueries>
  );
}
