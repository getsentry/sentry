import {Fragment} from 'react';

import type {PageFilters} from 'sentry/types/core';
import type {Series} from 'sentry/types/echarts';
import type {Confidence} from 'sentry/types/organization';
import type {TableDataWithTitle} from 'sentry/utils/discover/discoverQuery';
import type {AggregationOutputType} from 'sentry/utils/discover/fields';
import useApi from 'sentry/utils/useApi';
import useOrganization from 'sentry/utils/useOrganization';
import SpansWidgetQueries from 'sentry/views/dashboards/widgetCard/spansWidgetQueries';

import type {DashboardFilters, Widget} from '../types';
import {WidgetType} from '../types';

import IssueWidgetQueries from './issueWidgetQueries';
import ReleaseWidgetQueries from './releaseWidgetQueries';
import WidgetQueries from './widgetQueries';

type Results = {
  loading: boolean;
  confidence?: Confidence;
  errorMessage?: string;
  pageLinks?: string;
  tableResults?: TableDataWithTitle[];
  timeseriesResults?: Series[];
  timeseriesResultsTypes?: Record<string, AggregationOutputType>;
  totalIssuesCount?: string;
};

type Props = {
  children: (props: Results) => React.ReactNode;
  selection: PageFilters;
  widget: Widget;
  dashboardFilters?: DashboardFilters;
  onDataFetched?: (
    results: Pick<
      Results,
      | 'pageLinks'
      | 'tableResults'
      | 'timeseriesResults'
      | 'timeseriesResultsTypes'
      | 'totalIssuesCount'
      | 'confidence'
    >
  ) => void;
  onWidgetSplitDecision?: (splitDecision: WidgetType) => void;
  tableItemLimit?: number;
};

export function WidgetCardDataLoader({
  children,
  widget,
  selection,
  dashboardFilters,
  tableItemLimit,
  onDataFetched,
  onWidgetSplitDecision,
}: Props) {
  const api = useApi();
  const organization = useOrganization();

  if (widget.widgetType === WidgetType.ISSUE) {
    return (
      <IssueWidgetQueries
        api={api}
        organization={organization}
        widget={widget}
        selection={selection}
        limit={tableItemLimit}
        onDataFetched={onDataFetched}
        dashboardFilters={dashboardFilters}
      >
        {({tableResults, errorMessage, loading}) => (
          <Fragment>{children({tableResults, errorMessage, loading})}</Fragment>
        )}
      </IssueWidgetQueries>
    );
  }

  if (widget.widgetType === WidgetType.RELEASE) {
    return (
      <ReleaseWidgetQueries
        api={api}
        organization={organization}
        widget={widget}
        selection={selection}
        limit={widget.limit ?? tableItemLimit}
        onDataFetched={onDataFetched}
        dashboardFilters={dashboardFilters}
      >
        {({tableResults, timeseriesResults, errorMessage, loading}) => (
          <Fragment>
            {children({tableResults, timeseriesResults, errorMessage, loading})}
          </Fragment>
        )}
      </ReleaseWidgetQueries>
    );
  }

  if (widget.widgetType === WidgetType.SPANS) {
    return (
      <SpansWidgetQueries
        api={api}
        organization={organization}
        widget={widget}
        selection={selection}
        limit={tableItemLimit}
        onDataFetched={onDataFetched}
        dashboardFilters={dashboardFilters}
      >
        {props => <Fragment>{children({...props})}</Fragment>}
      </SpansWidgetQueries>
    );
  }

  return (
    <WidgetQueries
      api={api}
      organization={organization}
      widget={widget}
      selection={selection}
      limit={tableItemLimit}
      onDataFetched={onDataFetched}
      dashboardFilters={dashboardFilters}
      onWidgetSplitDecision={onWidgetSplitDecision}
    >
      {({
        tableResults,
        timeseriesResults,
        errorMessage,
        loading,
        timeseriesResultsTypes,
        confidence,
      }) => (
        <Fragment>
          {children({
            tableResults,
            timeseriesResults,
            errorMessage,
            loading,
            timeseriesResultsTypes,
            confidence,
          })}
        </Fragment>
      )}
    </WidgetQueries>
  );
}
