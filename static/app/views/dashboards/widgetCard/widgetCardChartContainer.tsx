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
import {
  ChartIntervalUnspecifiedStrategy,
  useChartInterval,
} from 'sentry/utils/useChartInterval';
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

  // Heat maps size their X/Y buckets from the rendered chart dimensions. We
  // measure the container here (above the data loader) because the query needs
  // these values before it fires. The query stays disabled until the container
  // has a non-zero width (see `useTraceMetricsHeatmapQuery`).
  const heatmapContainerRef = useRef<HTMLDivElement>(null);
  const {width: heatmapWidth, height: heatmapHeight} = useDimensions({
    elementRef: heatmapContainerRef,
  });
  // Use the biggest interval as the fallback, matching Explore's heat map.
  const [, , intervalOptions] = useChartInterval({
    unspecifiedStrategy: ChartIntervalUnspecifiedStrategy.USE_BIGGEST,
  });
  const fallbackInterval = intervalOptions[intervalOptions.length - 1]?.value ?? '';
  const heatmapInterval = isHeatmap
    ? getHeatmapXAxisBucketInterval(
        selection,
        fallbackInterval,
        heatmapWidth,
        intervalOptions
      )
    : undefined;
  const heatmapYBuckets = isHeatmap
    ? getHeatmapYAxisBucketCount(
        selection,
        heatmapInterval ?? '',
        heatmapWidth,
        heatmapHeight
      )
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
      widgetInterval={widgetInterval}
      heatmapInterval={heatmapInterval}
      heatmapYBuckets={heatmapYBuckets}
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

        // The heat map query can't fire until the container has been measured,
        // so treat it as loading until then to avoid a "No data found" flash.
        const isLoading =
          loading || (isHeatmap && (!heatmapYBuckets || heatmapYBuckets <= 0));

        const errorOrEmptyMessage = isLoading
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
              loading={isLoading}
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
    return (
      <HeatmapMeasureContainer ref={heatmapContainerRef}>
        {dataLoader}
      </HeatmapMeasureContainer>
    );
  }

  return dataLoader;
}

const HeatmapMeasureContainer = styled('div')`
  height: 100%;
  width: 100%;
`;
