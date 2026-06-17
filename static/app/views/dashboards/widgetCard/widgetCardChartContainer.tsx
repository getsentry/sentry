import {Fragment, useRef} from 'react';
import styled from '@emotion/styled';
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
import type {Confidence} from 'sentry/types/organization';
import type {TableDataWithTitle} from 'sentry/utils/discover/discoverQuery';
import type {AggregationOutputType, Sort} from 'sentry/utils/discover/fields';
import {useDebouncedValue} from 'sentry/utils/useDebouncedValue';
import {useDimensions} from 'sentry/utils/useDimensions';
import {useWidgetErrorCallback} from 'sentry/views/dashboards/contexts/widgetErrorContext';
import type {DashboardFilters, Widget as TWidget} from 'sentry/views/dashboards/types';
import {DisplayType, WidgetType} from 'sentry/views/dashboards/types';
import {usesTimeSeriesData, widgetFetchesOwnData} from 'sentry/views/dashboards/utils';
import {WidgetLegendNameEncoderDecoder} from 'sentry/views/dashboards/widgetLegendNameEncoderDecoder';
import type {WidgetLegendSelectionState} from 'sentry/views/dashboards/widgetLegendSelectionState';
import type {
  HeatMapSeries,
  TabularColumn,
} from 'sentry/views/dashboards/widgets/common/types';
import {getHeatmapXAxisBucketInterval} from 'sentry/views/dashboards/widgets/heatMapWidget/utils/getHeatmapXAxisBucketInterval';
import {getHeatmapYAxisBucketCount} from 'sentry/views/dashboards/widgets/heatMapWidget/utils/getHeatmapYAxisBucketCount';
import {Widget} from 'sentry/views/dashboards/widgets/widget/widget';

import WidgetCardChart from './chart';
import {WidgetCardDataLoader} from './widgetCardDataLoader';

// Resizing a widget (e.g. while editing the dashboard) changes its measured
// dimensions on every frame. Debounce them heavily so heat maps — which size
// their request from those dimensions — refetch once the resize settles rather
// than firing a request per pixel.
const HEATMAP_RESIZE_DEBOUNCE_MS = 500;
// `leading: true` keeps the first measurement fast; mid-resize churn collapses
// into a single trailing update once the drag settles.
const HEATMAP_RESIZE_DEBOUNCE_OPTIONS = {leading: true};

type Props = {
  selection: PageFilters;
  widget: TWidget;
  widgetLegendState: WidgetLegendSelectionState;
  api?: Client;
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
    confidence?: Confidence;
    dataScanned?: 'full' | 'partial';
    isSampled?: boolean | null;
    pageLinks?: string;
    sampleCount?: number;
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
  shouldResize?: boolean;
  showConfidenceWarning?: boolean;
  showLoadingText?: boolean;
  tableItemLimit?: number;
  widgetInterval?: string;
  windowWidth?: number;
};

export function WidgetCardChartContainer({
  selection,
  widget,
  dashboardFilters,
  isMobile,
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
  widgetInterval,
}: Props) {
  const onWidgetError = useWidgetErrorCallback();

  const isHeatmap = widget.displayType === DisplayType.HEATMAP;

  // Measure the chart area here (above the data loader) so that widgets which
  // size their request from the rendered dimensions — currently heat maps,
  // whose query needs the bucket interval/count before it fires — can do so.
  // The heat map query stays disabled until measured (see `useTraceMetricsHeatmapQuery`).
  const chartAreaRef = useRef<HTMLDivElement>(null);
  const {width: chartAreaWidth, height: chartAreaHeight} = useDimensions({
    elementRef: chartAreaRef,
  });
  const debouncedChartAreaWidth = useDebouncedValue(
    chartAreaWidth,
    HEATMAP_RESIZE_DEBOUNCE_MS,
    HEATMAP_RESIZE_DEBOUNCE_OPTIONS
  );
  const debouncedChartAreaHeight = useDebouncedValue(
    chartAreaHeight,
    HEATMAP_RESIZE_DEBOUNCE_MS,
    HEATMAP_RESIZE_DEBOUNCE_OPTIONS
  );
  const heatmapInterval = isHeatmap
    ? getHeatmapXAxisBucketInterval(selection, debouncedChartAreaWidth)
    : undefined;
  const yBuckets = isHeatmap
    ? getHeatmapYAxisBucketCount(debouncedChartAreaHeight)
    : undefined;

  const keepLegendState: EChartLegendSelectChangeHandler = ({selected}) => {
    widgetLegendState.setWidgetSelectionState(selected, widget);
  };

  function getErrorOrEmptyMessage(
    errorMessage: string | undefined,
    timeseriesResults: Series[] | undefined,
    tableResults: TableDataWithTitle[] | undefined,
    heatmapResults: HeatMapSeries | undefined,
    widgetType: DisplayType
  ) {
    if (widgetFetchesOwnData(widgetType)) {
      return;
    }

    // Heat maps return a single series object rather than table/timeseries rows.
    if (widgetType === DisplayType.HEATMAP) {
      return errorMessage
        ? errorMessage
        : heatmapResults === undefined || heatmapResults.values.length === 0
          ? t('No data found')
          : undefined;
    }

    // non-chart widgets need to look at tableResults
    const results = usesTimeSeriesData(widgetType) ? timeseriesResults : tableResults;

    return errorMessage
      ? errorMessage
      : results === undefined || results?.length === 0
        ? t('No data found')
        : undefined;
  }

  const dataLoader = (
    <WidgetCardDataLoader
      widget={widget}
      selection={selection}
      dashboardFilters={dashboardFilters}
      onDataFetched={onDataFetched}
      onWidgetSplitDecision={onWidgetSplitDecision}
      onDataFetchStart={onDataFetchStart}
      tableItemLimit={tableItemLimit}
      widgetInterval={isHeatmap ? heatmapInterval : widgetInterval}
      yBuckets={yBuckets}
    >
      {({
        tableResults,
        timeseriesResults,
        heatmapResults,
        errorMessage,
        loading,
        timeseriesResultsTypes,
        timeseriesResultsUnits,
        confidence,
        dataScanned,
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
              heatmapResults,
              widget.displayType
            );

        if (errorOrEmptyMessage) {
          if (
            typeof errorOrEmptyMessage === 'string' &&
            errorOrEmptyMessage !== t('No data found') &&
            onWidgetError
          ) {
            onWidgetError(widget, errorOrEmptyMessage);
          }

          return <Widget.WidgetError error={errorOrEmptyMessage} />;
        }

        return (
          <Fragment>
            <WidgetCardChart
              disableZoom={disableZoom}
              timeseriesResults={modifiedTimeseriesResults}
              tableResults={tableResults}
              heatmapResults={heatmapResults}
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
              dataScanned={dataScanned}
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

  // Heat maps need their rendered dimensions measured before the query fires,
  // so wrap them in a full-size measured container that stays mounted
  // regardless of the query/loading state.
  if (isHeatmap) {
    return <MeasuredChartArea ref={chartAreaRef}>{dataLoader}</MeasuredChartArea>;
  }

  return dataLoader;
}

const MeasuredChartArea = styled('div')`
  height: 100%;
  width: 100%;
`;
