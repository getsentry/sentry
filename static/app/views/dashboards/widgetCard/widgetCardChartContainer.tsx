import {Fragment} from 'react';
import styled from '@emotion/styled';
import type {DataZoomComponentOption, LegendComponentOption} from 'echarts';
import type {Location} from 'history';

import type {Client} from 'sentry/api';
import TransparentLoadingMask from 'sentry/components/charts/transparentLoadingMask';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import type {PageFilters} from 'sentry/types/core';
import type {EChartEventHandler, Series} from 'sentry/types/echarts';
import type {Organization} from 'sentry/types/organization';
import type {TableDataWithTitle} from 'sentry/utils/discover/discoverQuery';
import type {AggregationOutputType} from 'sentry/utils/discover/fields';
import {useLocation} from 'sentry/utils/useLocation';
import useRouter from 'sentry/utils/useRouter';

import type {DashboardFilters, Widget} from '../types';
import {WidgetType} from '../types';

import type {AugmentedEChartDataZoomHandler} from './chart';
import WidgetCardChart from './chart';
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
  chartGroup?: string;
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
  onWidgetSplitDecision?: (splitDecision: WidgetType) => void;
  onZoom?: AugmentedEChartDataZoomHandler;
  renderErrorMessage?: (errorMessage?: string) => React.ReactNode;
  shouldResize?: boolean;
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
  onWidgetSplitDecision,
  chartGroup,
  shouldResize,
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
                chartGroup={chartGroup}
                shouldResize={shouldResize}
              />
            </Fragment>
          );
        }}
      </ReleaseWidgetQueries>
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
              chartGroup={chartGroup}
              shouldResize={shouldResize}
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

export function LoadingScreen({loading}: {loading: boolean}) {
  if (!loading) {
    return null;
  }
  return (
    <StyledTransparentLoadingMask visible={loading}>
      <LoadingIndicator mini />
    </StyledTransparentLoadingMask>
  );
}
