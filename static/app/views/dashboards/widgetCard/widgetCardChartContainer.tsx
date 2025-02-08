import {Fragment} from 'react';
import styled from '@emotion/styled';
import type {LegendComponentOption} from 'echarts';
import type {Location} from 'history';

import type {Client} from 'sentry/api';
import TransparentLoadingMask from 'sentry/components/charts/transparentLoadingMask';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import type {PageFilters} from 'sentry/types/core';
import type {
  EChartDataZoomHandler,
  EChartEventHandler,
  Series,
} from 'sentry/types/echarts';
import type {Organization} from 'sentry/types/organization';
import type {TableDataWithTitle} from 'sentry/utils/discover/discoverQuery';
import type {AggregationOutputType} from 'sentry/utils/discover/fields';
import {useLocation} from 'sentry/utils/useLocation';
import WidgetLegendNameEncoderDecoder from 'sentry/views/dashboards/widgetLegendNameEncoderDecoder';

import type {DashboardFilters, Widget} from '../types';
import {WidgetType} from '../types';
import type WidgetLegendSelectionState from '../widgetLegendSelectionState';

import WidgetCardChart from './chart';
import {IssueWidgetCard} from './issueWidgetCard';
import {WidgetCardDataLoader} from './widgetCardDataLoader';

type Props = {
  api: Client;
  location: Location;
  organization: Organization;
  selection: PageFilters;
  widget: Widget;
  widgetLegendState: WidgetLegendSelectionState;
  chartGroup?: string;
  dashboardFilters?: DashboardFilters;
  expandNumbers?: boolean;
  isMobile?: boolean;
  legendOptions?: LegendComponentOption;
  minTableColumnWidth?: string;
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
  onZoom?: EChartDataZoomHandler;
  renderErrorMessage?: (errorMessage?: string) => React.ReactNode;
  shouldResize?: boolean;
  showConfidenceWarning?: boolean;
  tableItemLimit?: number;
  windowWidth?: number;
};

export function WidgetCardChartContainer({
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
  noPadding,
  onWidgetSplitDecision,
  chartGroup,
  shouldResize,
  widgetLegendState,
  showConfidenceWarning,
  minTableColumnWidth,
}: Props) {
  const location = useLocation();

  function keepLegendState({
    selected,
  }: {
    selected: Record<string, boolean>;
    type: 'legendselectchanged';
  }) {
    widgetLegendState.setWidgetSelectionState(selected, widget);
  }

  return (
    <WidgetCardDataLoader
      widget={widget}
      dashboardFilters={dashboardFilters}
      selection={selection}
      onDataFetched={onDataFetched}
      onWidgetSplitDecision={onWidgetSplitDecision}
      tableItemLimit={tableItemLimit}
    >
      {({
        tableResults,
        timeseriesResults,
        errorMessage,
        loading,
        timeseriesResultsTypes,
        confidence,
      }) => {
        if (widget.widgetType === WidgetType.ISSUE) {
          return (
            <Fragment>
              {typeof renderErrorMessage === 'function'
                ? renderErrorMessage(errorMessage)
                : null}
              <LoadingScreen loading={loading} />
              <IssueWidgetCard
                transformedResults={tableResults?.[0]!.data ?? []}
                loading={loading}
                errorMessage={errorMessage}
                widget={widget}
                location={location}
                selection={selection}
              />
            </Fragment>
          );
        }

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
              expandNumbers={expandNumbers}
              onZoom={onZoom}
              timeseriesResultsTypes={timeseriesResultsTypes}
              noPadding={noPadding}
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
              showConfidenceWarning={showConfidenceWarning}
              confidence={confidence}
              minTableColumnWidth={minTableColumnWidth}
            />
          </Fragment>
        );
      }}
    </WidgetCardDataLoader>
  );
}

export default WidgetCardChartContainer;

const StyledTransparentLoadingMask = styled((props: any) => (
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
