import {Fragment} from 'react';
import type {LegendComponentOption} from 'echarts';

import type {Client} from 'sentry/api';
import {t} from 'sentry/locale';
import type {PageFilters} from 'sentry/types/core';
import type {
  EChartDataZoomHandler,
  EChartEventHandler,
  EChartLegendSelectChangeHandler,
  Series,
} from 'sentry/types/echarts';
import type {TableDataWithTitle} from 'sentry/utils/discover/discoverQuery';
import type {AggregationOutputType, Sort} from 'sentry/utils/discover/fields';
import type {DashboardFilters, Widget} from 'sentry/views/dashboards/types';
import {DisplayType, WidgetType} from 'sentry/views/dashboards/types';
import {isChartDisplayType} from 'sentry/views/dashboards/utils';
import WidgetLegendNameEncoderDecoder from 'sentry/views/dashboards/widgetLegendNameEncoderDecoder';
import type WidgetLegendSelectionState from 'sentry/views/dashboards/widgetLegendSelectionState';
import type {TabularColumn} from 'sentry/views/dashboards/widgets/common/types';

import WidgetCardChart from './chart';
import {WidgetCardDataLoader} from './widgetCardDataLoader';

type Props = {
  api: Client;
  selection: PageFilters;
  widget: Widget;
  widgetLegendState: WidgetLegendSelectionState;
  chartGroup?: string;
  dashboardFilters?: DashboardFilters;
  disableTableActions?: boolean;
  disableZoom?: boolean;
  isMobile?: boolean;
  legendOptions?: LegendComponentOption;
  minTableColumnWidth?: number;
  noPadding?: boolean;
  onDataFetchStart?: () => void;
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
  onWidgetTableResizeColumn?: (columns: TabularColumn[]) => void;
  onWidgetTableSort?: (sort: Sort) => void;
  onZoom?: EChartDataZoomHandler;
  renderErrorMessage?: (errorMessage?: string) => React.ReactNode;
  shouldResize?: boolean;
  showConfidenceWarning?: boolean;
  showLoadingText?: boolean;
  tableItemLimit?: number;
  windowWidth?: number;
};

export function WidgetCardChartContainer({
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
  onDataFetched,
  noPadding,
  onWidgetSplitDecision,
  chartGroup,
  shouldResize,
  widgetLegendState,
  showConfidenceWarning,
  minTableColumnWidth,
  onDataFetchStart,
  disableZoom,
  showLoadingText,
  onWidgetTableSort,
  onWidgetTableResizeColumn,
  disableTableActions,
}: Props) {
  const keepLegendState: EChartLegendSelectChangeHandler = ({selected}) => {
    widgetLegendState.setWidgetSelectionState(selected, widget);
  };

  function getErrorOrEmptyMessage(
    errorMessage: string | undefined,
    timeseriesResults: Series[] | undefined,
    tableResults: TableDataWithTitle[] | undefined,
    widgetType: DisplayType
  ) {
    // non-chart widgets need to look at tableResults
    const results = isChartDisplayType(widgetType) ? timeseriesResults : tableResults;

    return errorMessage
      ? errorMessage
      : results === undefined || results?.length === 0
        ? t('No data found')
        : undefined;
  }

  return (
    <WidgetCardDataLoader
      widget={widget}
      selection={selection}
      dashboardFilters={dashboardFilters}
      onDataFetched={onDataFetched}
      onWidgetSplitDecision={onWidgetSplitDecision}
      onDataFetchStart={onDataFetchStart}
      tableItemLimit={tableItemLimit}
    >
      {({
        tableResults,
        timeseriesResults,
        errorMessage,
        loading,
        timeseriesResultsTypes,
        timeseriesResultsUnits,
        confidence,
        sampleCount,
        isSampled,
      }) => {
        // Bind timeseries to widget for ability to control each widget's legend individually
        const modifiedTimeseriesResults =
          WidgetLegendNameEncoderDecoder.modifyTimeseriesNames(widget, timeseriesResults);

        const errorOrEmptyMessage = loading
          ? errorMessage
          : getErrorOrEmptyMessage(
              errorMessage,
              modifiedTimeseriesResults,
              tableResults,
              widget.displayType
            );

        return (
          <Fragment>
            {typeof renderErrorMessage === 'function'
              ? renderErrorMessage(errorOrEmptyMessage)
              : null}
            <WidgetCardChart
              disableZoom={disableZoom}
              timeseriesResults={modifiedTimeseriesResults}
              tableResults={tableResults}
              errorMessage={errorOrEmptyMessage}
              loading={loading}
              widget={widget}
              selection={selection}
              isMobile={isMobile}
              windowWidth={windowWidth}
              onZoom={onZoom}
              timeseriesResultsTypes={timeseriesResultsTypes}
              timeseriesResultsUnits={timeseriesResultsUnits}
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
              sampleCount={sampleCount}
              minTableColumnWidth={minTableColumnWidth}
              isSampled={isSampled}
              showLoadingText={showLoadingText}
              onWidgetTableSort={onWidgetTableSort}
              onWidgetTableResizeColumn={onWidgetTableResizeColumn}
              disableTableActions={disableTableActions}
              dashboardFilters={dashboardFilters}
            />
          </Fragment>
        );
      }}
    </WidgetCardDataLoader>
  );
}
