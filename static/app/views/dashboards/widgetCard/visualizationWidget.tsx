import {Fragment} from 'react';
import {Link} from 'react-router-dom';
import {useTheme} from '@emotion/react';

import {Container, Flex, type ContainerProps} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';
import {Tooltip} from '@sentry/scraps/tooltip';

import {usePageFilters} from 'sentry/components/pageFilters/usePageFilters';
import {IconWarning} from 'sentry/icons';
import type {PageFilters} from 'sentry/types/core';
import type {EChartDataZoomHandler, Series} from 'sentry/types/echarts';
import type {Confidence} from 'sentry/types/organization';
import {defined} from 'sentry/utils';
import type {TableDataWithTitle} from 'sentry/utils/discover/discoverQuery';
import type {AggregationOutputType, DataUnit, Sort} from 'sentry/utils/discover/fields';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {useLocation} from 'sentry/utils/useLocation';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useReleaseStats} from 'sentry/utils/useReleaseStats';
import {
  WidgetType,
  type DashboardFilters,
  type Widget,
} from 'sentry/views/dashboards/types';
import {applyDashboardFilters, usesTimeSeriesData} from 'sentry/views/dashboards/utils';
import {
  findLinkedDashboardForField,
  getLinkedDashboardUrl,
} from 'sentry/views/dashboards/utils/getLinkedDashboardUrl';
import {getChartType} from 'sentry/views/dashboards/utils/getWidgetExploreUrl';
import {transformWidgetSeriesToTimeSeries} from 'sentry/views/dashboards/widgetCard/transformWidgetSeriesToTimeSeries';
import {MISSING_DATA_MESSAGE} from 'sentry/views/dashboards/widgets/common/settings';
import type {
  LegendSelection,
  TabularColumn,
  TimeSeries,
  TimeSeriesGroupBy,
} from 'sentry/views/dashboards/widgets/common/types';
import {formatTooltipValue} from 'sentry/views/dashboards/widgets/timeSeriesWidget/formatters/formatTooltipValue';
import {createPlottableFromTimeSeries} from 'sentry/views/dashboards/widgets/timeSeriesWidget/plottables/createPlottableFromTimeSeries';
import type {Plottable} from 'sentry/views/dashboards/widgets/timeSeriesWidget/plottables/plottable';
import {Thresholds} from 'sentry/views/dashboards/widgets/timeSeriesWidget/plottables/thresholds';
import {TimeSeriesWidgetVisualization} from 'sentry/views/dashboards/widgets/timeSeriesWidget/timeSeriesWidgetVisualization';
import {getExploreUrl} from 'sentry/views/explore/utils';
import {TextAlignRight} from 'sentry/views/insights/common/components/textAlign';
import type {LoadableChartWidgetProps} from 'sentry/views/insights/common/components/widgets/types';
import {ModelName} from 'sentry/views/insights/pages/agents/components/modelName';
import {
  SeriesColorIndicator,
  WidgetFooterTable,
} from 'sentry/views/insights/pages/platform/shared/styles';
import {SpanFields} from 'sentry/views/insights/types';

import {WidgetCardConfidenceFooter} from './confidenceFooter';
import {WidgetCardDataLoader} from './widgetCardDataLoader';

interface VisualizationWidgetProps {
  selection: PageFilters;
  widget: Widget;
  dashboardFilters?: DashboardFilters;
  legendSelection?: LegendSelection;
  onDataFetchStart?: () => void;
  onDataFetched?: (results: {
    pageLinks?: string;
    tableResults?: any[];
    timeseriesResults?: Series[];
    timeseriesResultsTypes?: Record<string, AggregationOutputType>;
    timeseriesResultsUnits?: Record<string, DataUnit>;
    totalIssuesCount?: string;
  }) => void;
  onLegendSelectionChange?: (selection: LegendSelection) => void;
  onWidgetTableResizeColumn?: (columns: TabularColumn[]) => void;
  onWidgetTableSort?: (sort: Sort) => void;
  onZoom?: EChartDataZoomHandler;
  renderErrorMessage?: (errorMessage?: string) => React.ReactNode;
  showConfidenceWarning?: boolean;
  showReleaseAs?: LoadableChartWidgetProps['showReleaseAs'];
  tableItemLimit?: number;
  widgetInterval?: string;
}

export function VisualizationWidget({
  widget,
  selection,
  dashboardFilters,
  onDataFetched,
  onDataFetchStart,
  tableItemLimit,
  widgetInterval,
  renderErrorMessage,
  showReleaseAs = 'bubble',
  showConfidenceWarning,
  onZoom,
  legendSelection,
  onLegendSelectionChange,
}: VisualizationWidgetProps) {
  const {releases: releasesWithDate} = useReleaseStats(selection, {
    enabled: showReleaseAs !== 'none',
  });

  const releases =
    releasesWithDate?.map(({date, version}) => ({
      timestamp: date,
      version,
    })) ?? [];

  return (
    <WidgetCardDataLoader
      widget={widget}
      selection={selection}
      dashboardFilters={dashboardFilters}
      onDataFetched={onDataFetched}
      onDataFetchStart={onDataFetchStart}
      tableItemLimit={tableItemLimit}
      widgetInterval={widgetInterval}
    >
      {({
        timeseriesResults,
        timeseriesResultsTypes,
        timeseriesResultsUnits,
        tableResults,
        errorMessage,
        loading,
        confidence,
        dataScanned,
        isSampled,
        sampleCount,
      }) => {
        return (
          <VisualizationWidgetContent
            widget={widget}
            timeseriesResults={timeseriesResults ?? []}
            timeseriesResultsTypes={timeseriesResultsTypes}
            timeseriesResultsUnits={timeseriesResultsUnits}
            tableResults={tableResults}
            errorMessage={errorMessage}
            loading={loading}
            releases={releases}
            showReleaseAs={showReleaseAs}
            renderErrorMessage={renderErrorMessage}
            dashboardFilters={dashboardFilters}
            showConfidenceWarning={showConfidenceWarning}
            confidence={confidence}
            dataScanned={dataScanned}
            isSampled={isSampled}
            sampleCount={sampleCount}
            onZoom={onZoom}
            legendSelection={legendSelection}
            onLegendSelectionChange={onLegendSelectionChange}
          />
        );
      }}
    </WidgetCardDataLoader>
  );
}

interface VisualizationWidgetContentProps {
  loading: boolean;
  releases: Array<{timestamp: string; version: string}>;
  showReleaseAs: LoadableChartWidgetProps['showReleaseAs'];
  timeseriesResults: Series[];
  widget: Widget;
  confidence?: Confidence;
  dashboardFilters?: DashboardFilters;
  dataScanned?: 'full' | 'partial';
  errorMessage?: string;
  isSampled?: boolean | null;
  legendSelection?: LegendSelection;
  onLegendSelectionChange?: (selection: LegendSelection) => void;
  onZoom?: EChartDataZoomHandler;
  renderErrorMessage?: (errorMessage?: string) => React.ReactNode;
  sampleCount?: number;
  showConfidenceWarning?: boolean;
  tableResults?: TableDataWithTitle[];
  timeseriesResultsTypes?: Record<string, AggregationOutputType>;
  timeseriesResultsUnits?: Record<string, DataUnit>;
}

function VisualizationWidgetContent({
  widget,
  timeseriesResults,
  timeseriesResultsTypes,
  timeseriesResultsUnits,
  tableResults,
  errorMessage,
  loading,
  releases,
  showReleaseAs,
  renderErrorMessage,
  dashboardFilters,
  showConfidenceWarning,
  confidence,
  dataScanned,
  isSampled,
  sampleCount,
  onZoom,
  legendSelection,
  onLegendSelectionChange,
}: VisualizationWidgetContentProps) {
  const theme = useTheme();
  const organization = useOrganization();
  const location = useLocation();
  const {selection} = usePageFilters();

  const firstWidgetQuery = widget.queries[0];
  const aggregates = firstWidgetQuery?.aggregates ?? []; // All widget queries have the same aggregates
  const columns = firstWidgetQuery?.columns ?? []; // All widget queries have the same columns

  const timeSeriesWithPlottable = timeseriesResults
    .map(series => {
      const transformed = transformWidgetSeriesToTimeSeries(
        series,
        widget,
        timeseriesResultsTypes,
        timeseriesResultsUnits
      );

      if (!transformed) {
        return null;
      }

      const {timeSeries, label, seriesName, widgetQuery} = transformed;
      const plottable = createPlottableFromTimeSeries(
        timeSeries,
        widget,
        label,
        seriesName,
        timeSeries.meta.isOther ? theme.tokens.dataviz.semantic.neutral : undefined
      );
      if (!plottable) {
        return null;
      }

      // Match the timeseries to its corresponding table result by query index
      const queryIndex = widget.queries.indexOf(widgetQuery);
      const tableData = tableResults?.[queryIndex]?.data;

      return [timeSeries, plottable, tableData] satisfies [
        TimeSeries,
        Plottable,
        TableDataWithTitle['data'] | undefined,
      ];
    })
    .filter(defined);

  const errorDisplay =
    renderErrorMessage && errorMessage ? renderErrorMessage(errorMessage) : null;

  const plottableWithNeedsColor = timeSeriesWithPlottable.filter(
    ([_, plottable]) => plottable.needsColor
  ).length;

  const colorPalette =
    plottableWithNeedsColor > 0
      ? theme.chart.getColorPalette(plottableWithNeedsColor - 1)
      : [];

  const showBreakdownData =
    widget.legendType === 'breakdown' &&
    usesTimeSeriesData(widget.displayType) &&
    tableResults &&
    tableResults.length > 0;

  // We only support one column for legend breakdown right now
  const firstColumn = columns[0];
  const linkedDashboard = findLinkedDashboardForField(firstWidgetQuery, firstColumn);

  const footerTable = showBreakdownData ? (
    <WidgetFooterTable>
      {timeSeriesWithPlottable.map(([timeSeries, plottable, tableDataRows], index) => {
        if (timeSeries.meta.isOther) {
          return null;
        }

        let value: number | null = null;
        const yAxis = timeSeries.yAxis;
        const firstColumnGroupByValue = timeSeries.groupBy?.find(
          groupBy => groupBy.key === firstColumn
        )?.value;

        if (tableDataRows) {
          // If there is one column, the table results will be an array with multiple elements
          // [{column: 'value', aggregate: 123}, {column: 'value', aggregate: 123}]
          if (columns.length === 1) {
            if (firstColumnGroupByValue !== undefined && firstColumn) {
              // for 20 series, this is only 20 x 20 lookups, which is negligible and worth it for code readability
              value = tableDataRows.find(
                row => row[firstColumn] === firstColumnGroupByValue
              )?.[yAxis] as number;
            }
          }
          // If there is no columns, and only aggregates, the table result will be an array with a single element
          // [{aggregate1: 123}, {aggregate2: 345}]
          else if (columns.length === 0 && aggregates.length > 0) {
            const row = tableDataRows[0];
            if (row) {
              value = row[yAxis] as number;
            }
          }
        }
        const dataType = timeSeries.meta.valueType;
        const dataUnit = timeSeries.meta.valueUnit ?? undefined;
        const label = plottable?.label ?? timeSeries.yAxis;

        const labelDisplay = renderBreakdownLabel(
          firstColumn,
          firstColumnGroupByValue,
          label
        );

        let labelContent = <Text>{labelDisplay}</Text>;

        // TODO: to simplify things, we only support one widget query for explore urls right now
        // Otherwise we have to map the correct widget query to the timeseries result
        if (
          firstColumn &&
          typeof firstColumnGroupByValue === 'string' &&
          widget.queries.length === 1 &&
          widget.widgetType === WidgetType.SPANS
        ) {
          const exploreQuery = new MutableSearch(widget.queries[0]?.conditions ?? '');
          exploreQuery.addFilterValue(firstColumn, firstColumnGroupByValue);
          const exploreUrl = getExploreUrl({
            organization,
            selection,
            aggregateField: [
              {chartType: getChartType(widget.displayType), yAxes: [yAxis]},
            ],
            query: applyDashboardFilters(
              exploreQuery.formatString(),
              dashboardFilters,
              widget.widgetType
            ),
          });
          labelContent = <Link to={exploreUrl}>{labelDisplay}</Link>;
        }

        if (
          linkedDashboard &&
          firstColumn &&
          widget.widgetType &&
          typeof firstColumnGroupByValue === 'string'
        ) {
          const linkedDashbordUrl = getLinkedDashboardUrl({
            linkedDashboard,
            organizationSlug: organization.slug,
            field: firstColumn,
            value: firstColumnGroupByValue,
            widgetType: widget.widgetType,
            dashboardFilters,
            locationQuery: location.query,
          });
          if (linkedDashbordUrl) {
            labelContent = <Link to={linkedDashbordUrl}>{labelDisplay}</Link>;
          }
        }

        return (
          <Fragment key={plottable.name}>
            <Container>
              <SeriesColorIndicator
                style={{
                  backgroundColor: colorPalette[index],
                }}
              />
            </Container>
            <Tooltip title={label} showOnlyOnOverflow>
              {labelContent}
            </Tooltip>
            <TextAlignRight>
              {value === null ? '—' : formatTooltipValue(value, dataType, dataUnit)}
            </TextAlignRight>
          </Fragment>
        );
      })}
    </WidgetFooterTable>
  ) : null;

  if (loading) {
    return <TimeSeriesWidgetVisualization.LoadingPlaceholder />;
  }
  if (errorDisplay) {
    return errorDisplay;
  }

  const timeseriesContainerPadding: ContainerProps = {
    paddingLeft: 'xl',
    paddingRight: 'xl',
    paddingBottom: 'lg',
  };

  const plottables: Plottable[] = timeSeriesWithPlottable.map(
    ([, plottable]) => plottable
  );

  if (
    defined(widget.thresholds?.max_values.max1) ||
    defined(widget.thresholds?.max_values.max2)
  ) {
    plottables.push(
      new Thresholds({
        thresholds: widget.thresholds,
        dataType: timeSeriesWithPlottable[0]?.[0]?.meta?.valueType,
      })
    );
  }

  // Check for empty plottables before rendering the visualization
  // This prevents TimeSeriesWidgetVisualization from throwing an error
  // that would get caught by ErrorBoundary and persist across filter changes
  const hasNoPlottableData = plottables.every(plottable => plottable.isEmpty);
  if (hasNoPlottableData) {
    return (
      <Flex align="center" justify="center" height="100%" gap="xs">
        <IconWarning size="sm" variant="muted" />
        <Text variant="muted">{MISSING_DATA_MESSAGE}</Text>
      </Flex>
    );
  }

  const confidenceFooter = showConfidenceWarning ? (
    <WidgetCardConfidenceFooter
      confidence={confidence}
      dataScanned={dataScanned}
      isSampled={isSampled}
      loading={loading}
      sampleCount={sampleCount}
      series={timeseriesResults}
      timeseriesResults={timeseriesResults}
      widget={widget}
      yAxis={widget.queries[0]?.aggregates[0] ?? ''}
    />
  ) : null;

  if (showBreakdownData) {
    return (
      <Flex direction="column" height="100%">
        <Container overflow="hidden" flex={2} {...timeseriesContainerPadding}>
          <TimeSeriesWidgetVisualization
            plottables={plottables}
            releases={releases}
            showReleaseAs={showReleaseAs}
            showLegend="never"
            axisRange={widget.axisRange}
            onZoom={onZoom}
            legendSelection={legendSelection}
            onLegendSelectionChange={onLegendSelectionChange}
          />
        </Container>
        <Container {...timeseriesContainerPadding}>{confidenceFooter}</Container>
        <Flex flex={1} direction="column" borderTop="primary" overflowY="auto">
          <Container flex={1} width="100%">
            {footerTable}
          </Container>
        </Flex>
      </Flex>
    );
  }

  return (
    <Flex direction="column" height="100%">
      <Container flex={1} {...timeseriesContainerPadding}>
        <TimeSeriesWidgetVisualization
          plottables={plottables}
          releases={releases}
          showReleaseAs={showReleaseAs}
          axisRange={widget.axisRange}
          onZoom={onZoom}
          legendSelection={legendSelection}
          onLegendSelectionChange={onLegendSelectionChange}
        />
      </Container>
      <Container {...timeseriesContainerPadding}>{confidenceFooter}</Container>
    </Flex>
  );
}

/**
 * Returns a custom label element for breakdown legend rows that need special rendering
 * (e.g., model icons for AI model fields), or falls back to the plain text label.
 */
function renderBreakdownLabel(
  column?: string,
  groupByValue?: TimeSeriesGroupBy['value'],
  fallbackLabel?: string
): React.ReactNode {
  if (
    typeof groupByValue === 'string' &&
    (column === SpanFields.GEN_AI_REQUEST_MODEL ||
      column === SpanFields.GEN_AI_RESPONSE_MODEL)
  ) {
    return <ModelName modelId={groupByValue} size={14} />;
  }

  return fallbackLabel;
}
