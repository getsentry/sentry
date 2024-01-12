import {Fragment} from 'react';
import styled from '@emotion/styled';
import type {DataZoomComponentOption} from 'echarts';
import {LegendComponentOption} from 'echarts';
import {Location} from 'history';

import {Client} from 'sentry/api';
import TransparentLoadingMask from 'sentry/components/charts/transparentLoadingMask';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {Organization, PageFilters} from 'sentry/types';
import {EChartEventHandler, Series} from 'sentry/types/echarts';
import {TableDataWithTitle} from 'sentry/utils/discover/discoverQuery';
import {AggregationOutputType} from 'sentry/utils/discover/fields';
import {useLocation} from 'sentry/utils/useLocation';
import useRouter from 'sentry/utils/useRouter';
import MetricWidgetQueries from 'sentry/views/dashboards/widgetCard/metricWidgetQueries';

import {DashboardFilters, Widget, WidgetType} from '../types';

import WidgetCardChart, {AugmentedEChartDataZoomHandler} from './chart';
import {IssueWidgetCard} from './issueWidgetCard';
import IssueWidgetQueries from './issueWidgetQueries';
import ReleaseWidgetQueries from './releaseWidgetQueries';
import WidgetQueries from './widgetQueries';

type Props = {
  api: Client;
  location: Location;
  organization: Organization;
  selection: PageFilters;
  widget: Widget;
  chartZoomOptions?: DataZoomComponentOption;
  dashboardFilters?: DashboardFilters;
  expandNumbers?: boolean;
  isMobile?: boolean;
  legendOptions?: LegendComponentOption;
  noPadding?: boolean;
  onDataFetched?: (results: {
    pageLinks?: string;
    tableResults?: TableDataWithTitle[];
    timeseriesResults?: Series[];
    timeseriesResultsTypes?: Record<string, AggregationOutputType>;
    totalIssuesCount?: string;
  }) => void;
  onLegendSelectChanged?: EChartEventHandler<{
    name: string;
    selected: Record<string, boolean>;
    type: 'legendselectchanged';
  }>;
  onZoom?: AugmentedEChartDataZoomHandler;
  renderErrorMessage?: (errorMessage?: string) => React.ReactNode;
  showSlider?: boolean;
  tableItemLimit?: number;
  windowWidth?: number;
};

export function WidgetCardChartContainer({
  api,
  organization,
  selection,
  widget,
  dashboardFilters,
  isMobile,
  renderErrorMessage,
  tableItemLimit,
  windowWidth,
  onZoom,
  onLegendSelectChanged,
  legendOptions,
  expandNumbers,
  onDataFetched,
  showSlider,
  noPadding,
  chartZoomOptions,
}: Props) {
  const location = useLocation();
  const router = useRouter();
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
        {({tableResults, errorMessage, loading}) => {
          return (
            <Fragment>
              {typeof renderErrorMessage === 'function'
                ? renderErrorMessage(errorMessage)
                : null}
              <LoadingScreen loading={loading} />
              <IssueWidgetCard
                transformedResults={tableResults?.[0].data ?? []}
                loading={loading}
                errorMessage={errorMessage}
                widget={widget}
                organization={organization}
                location={location}
                selection={selection}
              />
            </Fragment>
          );
        }}
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
        {({tableResults, timeseriesResults, errorMessage, loading}) => {
          return (
            <Fragment>
              {typeof renderErrorMessage === 'function'
                ? renderErrorMessage(errorMessage)
                : null}
              <WidgetCardChart
                timeseriesResults={timeseriesResults}
                tableResults={tableResults}
                errorMessage={errorMessage}
                loading={loading}
                location={location}
                widget={widget}
                selection={selection}
                router={router}
                organization={organization}
                isMobile={isMobile}
                windowWidth={windowWidth}
                expandNumbers={expandNumbers}
                onZoom={onZoom}
                showSlider={showSlider}
                noPadding={noPadding}
                chartZoomOptions={chartZoomOptions}
              />
            </Fragment>
          );
        }}
      </ReleaseWidgetQueries>
    );
  }

  if (widget.widgetType === WidgetType.METRICS) {
    return (
      <MetricWidgetQueries
        api={api}
        organization={organization}
        widget={widget}
        selection={selection}
        limit={widget.limit ?? tableItemLimit}
        onDataFetched={onDataFetched}
        dashboardFilters={dashboardFilters}
      >
        {({tableResults, timeseriesResults, errorMessage, loading}) => {
          return (
            <Fragment>
              {typeof renderErrorMessage === 'function'
                ? renderErrorMessage(errorMessage)
                : null}
              <WidgetCardChart
                timeseriesResults={timeseriesResults}
                tableResults={tableResults}
                errorMessage={errorMessage}
                loading={loading}
                location={location}
                widget={widget}
                selection={selection}
                router={router}
                organization={organization}
                isMobile={isMobile}
                windowWidth={windowWidth}
                expandNumbers={expandNumbers}
                onZoom={onZoom}
                showSlider={showSlider}
                noPadding={noPadding}
                chartZoomOptions={chartZoomOptions}
              />
            </Fragment>
          );
        }}
      </MetricWidgetQueries>
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
    >
      {({
        tableResults,
        timeseriesResults,
        errorMessage,
        loading,
        timeseriesResultsTypes,
      }) => {
        return (
          <Fragment>
            {typeof renderErrorMessage === 'function'
              ? renderErrorMessage(errorMessage)
              : null}
            <WidgetCardChart
              timeseriesResults={timeseriesResults}
              tableResults={tableResults}
              errorMessage={errorMessage}
              loading={loading}
              location={location}
              widget={widget}
              selection={selection}
              router={router}
              organization={organization}
              isMobile={isMobile}
              windowWidth={windowWidth}
              onZoom={onZoom}
              onLegendSelectChanged={onLegendSelectChanged}
              legendOptions={legendOptions}
              expandNumbers={expandNumbers}
              showSlider={showSlider}
              noPadding={noPadding}
              chartZoomOptions={chartZoomOptions}
              timeseriesResultsTypes={timeseriesResultsTypes}
            />
          </Fragment>
        );
      }}
    </WidgetQueries>
  );
}

export default WidgetCardChartContainer;

const StyledTransparentLoadingMask = styled(props => (
  <TransparentLoadingMask {...props} maskBackgroundColor="transparent" />
))`
  display: flex;
  justify-content: center;
  align-items: center;
`;

function LoadingScreen({loading}: {loading: boolean}) {
  if (!loading) {
    return null;
  }
  return (
    <StyledTransparentLoadingMask visible={loading}>
      <LoadingIndicator mini />
    </StyledTransparentLoadingMask>
  );
}
