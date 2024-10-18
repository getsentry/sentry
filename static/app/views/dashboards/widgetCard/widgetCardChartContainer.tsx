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
import WidgetLegendNameEncoderDecoder from 'sentry/views/dashboards/widgetLegendNameEncoderDecoder';

import type {DashboardFilters, Widget} from '../types';
import {WidgetType} from '../types';
import type WidgetLegendSelectionState from '../widgetLegendSelectionState';

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
  widgetLegendState: WidgetLegendSelectionState;
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
  widgetLegendState,
}: Props) {
  const location = useLocation();

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

  function keepLegendState({
    selected,
  }: {
    selected: Record<string, boolean>;
    type: 'legendselectchanged';
  }) {
    widgetLegendState.setWidgetSelectionState(selected, widget);
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
          // Bind timeseries to widget for ability to control each widget's legend individually
          // NOTE: e-charts legends control all charts that have the same series name so attaching
          // widget id will differentiate the charts allowing them to be controlled individually
          const modifiedTimeseriesResults =
            WidgetLegendNameEncoderDecoder.modifyTimeseriesNames(
              widget,
              timeseriesResults
            );
          return (
            <Fragment>
              {typeof renderErrorMessage === 'function'
                ? renderErrorMessage(errorMessage)
                : null}
              <WidgetCardChart
                timeseriesResults={modifiedTimeseriesResults}
                tableResults={tableResults}
                errorMessage={errorMessage}
                loading={loading}
                location={location}
                widget={widget}
                selection={selection}
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
                onLegendSelectChanged={
                  onLegendSelectChanged ? onLegendSelectChanged : keepLegendState
                }
                legendOptions={
                  legendOptions
                    ? legendOptions
                    : {selected: widgetLegendState.getWidgetSelectionState(widget)}
                }
                widgetLegendState={widgetLegendState}
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
        // Bind timeseries to widget for ability to control each widget's legend individually
        const modifiedTimeseriesResults =
          WidgetLegendNameEncoderDecoder.modifyTimeseriesNames(widget, timeseriesResults);
        return (
          <Fragment>
            {typeof renderErrorMessage === 'function'
              ? renderErrorMessage(errorMessage)
              : null}
            <WidgetCardChart
              timeseriesResults={modifiedTimeseriesResults}
              tableResults={tableResults}
              errorMessage={errorMessage}
              loading={loading}
              location={location}
              widget={widget}
              selection={selection}
              organization={organization}
              isMobile={isMobile}
              windowWidth={windowWidth}
              onZoom={onZoom}
              onLegendSelectChanged={
                onLegendSelectChanged ? onLegendSelectChanged : keepLegendState
              }
              legendOptions={
                legendOptions
                  ? legendOptions
                  : {selected: widgetLegendState.getWidgetSelectionState(widget)}
              }
              expandNumbers={expandNumbers}
              showSlider={showSlider}
              noPadding={noPadding}
              chartZoomOptions={chartZoomOptions}
              timeseriesResultsTypes={timeseriesResultsTypes}
              chartGroup={chartGroup}
              shouldResize={shouldResize}
              widgetLegendState={widgetLegendState}
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
