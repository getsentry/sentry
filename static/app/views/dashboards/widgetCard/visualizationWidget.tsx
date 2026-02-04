import {Fragment, useMemo} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import trimStart from 'lodash/trimStart';

import {Flex} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';
import {Tooltip} from '@sentry/scraps/tooltip';

import PanelAlert from 'sentry/components/panels/panelAlert';
import type {PageFilters} from 'sentry/types/core';
import type {Series} from 'sentry/types/echarts';
import {
  isAggregateField,
  type AggregationOutputType,
  type DataUnit,
  type Sort,
} from 'sentry/utils/discover/fields';
import {TOP_N} from 'sentry/utils/discover/types';
import {transformLegacySeriesToPlottables} from 'sentry/utils/timeSeries/transformLegacySeriesToPlottables';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import {useReleaseStats} from 'sentry/utils/useReleaseStats';
import {getDatasetConfig} from 'sentry/views/dashboards/datasetConfig/base';
import type {DashboardFilters, Widget} from 'sentry/views/dashboards/types';
import {DisplayType} from 'sentry/views/dashboards/types';
import type {TabularColumn} from 'sentry/views/dashboards/widgets/common/types';
import {formatYAxisValue} from 'sentry/views/dashboards/widgets/timeSeriesWidget/formatters/formatYAxisValue';
import {FALLBACK_TYPE} from 'sentry/views/dashboards/widgets/timeSeriesWidget/settings';
import {TimeSeriesWidgetVisualization} from 'sentry/views/dashboards/widgets/timeSeriesWidget/timeSeriesWidgetVisualization';
import type {LoadableChartWidgetProps} from 'sentry/views/insights/common/components/widgets/types';
import {
  SeriesColorIndicator,
  WidgetFooterTable,
} from 'sentry/views/insights/pages/platform/shared/styles';

import {WidgetCardDataLoader} from './widgetCardDataLoader';

interface VisualizationWidgetProps {
  selection: PageFilters;
  widget: Widget;
  dashboardFilters?: DashboardFilters;
  onDataFetchStart?: () => void;
  onDataFetched?: (results: {
    pageLinks?: string;
    tableResults?: any[];
    timeseriesResults?: Series[];
    timeseriesResultsTypes?: Record<string, AggregationOutputType>;
    totalIssuesCount?: string;
  }) => void;
  onWidgetTableResizeColumn?: (columns: TabularColumn[]) => void;
  onWidgetTableSort?: (sort: Sort) => void;
  renderErrorMessage?: (errorMessage?: string) => React.ReactNode;
  showLegendBreakdown?: boolean;
  showReleaseAs?: LoadableChartWidgetProps['showReleaseAs'];
  tableItemLimit?: number;
}

export function VisualizationWidget({
  widget,
  selection,
  dashboardFilters,
  onDataFetched,
  onDataFetchStart,
  tableItemLimit,
  renderErrorMessage,
  showReleaseAs = 'bubble',
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
    >
      {({
        timeseriesResults,
        timeseriesResultsTypes,
        timeseriesResultsUnits,
        errorMessage,
        loading,
      }) => {
        return (
          <VisualizationWidgetContent
            widget={widget}
            selection={selection}
            dashboardFilters={dashboardFilters}
            timeseriesResults={timeseriesResults}
            timeseriesResultsTypes={timeseriesResultsTypes}
            timeseriesResultsUnits={timeseriesResultsUnits}
            errorMessage={errorMessage}
            loading={loading}
            releases={releases}
            showReleaseAs={showReleaseAs}
            renderErrorMessage={renderErrorMessage}
          />
        );
      }}
    </WidgetCardDataLoader>
  );
}

interface VisualizationWidgetContentProps {
  loading: boolean;
  releases: Array<{timestamp: string; version: string}>;
  selection: PageFilters;
  showReleaseAs: LoadableChartWidgetProps['showReleaseAs'];
  widget: Widget;
  dashboardFilters?: DashboardFilters;
  errorMessage?: string;
  renderErrorMessage?: (errorMessage?: string) => React.ReactNode;
  timeseriesResults?: Series[];
  timeseriesResultsTypes?: Record<string, AggregationOutputType>;
  timeseriesResultsUnits?: Record<string, DataUnit>;
}

function VisualizationWidgetContent({
  widget,
  selection,
  dashboardFilters,
  timeseriesResults,
  timeseriesResultsTypes,
  timeseriesResultsUnits,
  errorMessage,
  loading,
  releases,
  showReleaseAs,
  renderErrorMessage,
}: VisualizationWidgetContentProps) {
  const theme = useTheme();
  const organization = useOrganization();
  const {selection: pageFiltersSelection} = usePageFilters();

  const plottables = transformLegacySeriesToPlottables(
    timeseriesResults,
    timeseriesResultsTypes,
    timeseriesResultsUnits,
    widget
  );

  const config = getDatasetConfig(widget.widgetType);

  const tableWidget = useMemo((): Widget => {
    return {
      ...widget,
      displayType: DisplayType.TABLE,
      limit: widget.limit ?? TOP_N,
      queries: widget.queries.map(query => {
        const aggregates = [...(query.aggregates ?? [])];
        const columns = [...(query.columns ?? [])];

        // Table requests require the orderby field to be included in the fields, but series results don't always need that
        if (query.orderby) {
          const orderbyField = trimStart(query.orderby, '-');
          if (isAggregateField(orderbyField) && !aggregates.includes(orderbyField)) {
            aggregates.push(orderbyField);
          }
          if (!isAggregateField(orderbyField) && !columns.includes(orderbyField)) {
            columns.push(orderbyField);
          }
        }
        return {
          ...query,
          fields: [...columns, ...aggregates],
          aggregates,
          columns,
        };
      }),
    };
  }, [widget]);

  const tableQueryResult = config.useTableQuery?.({
    widget: tableWidget,
    organization,
    pageFilters: selection ?? pageFiltersSelection,
    enabled: widget?.legendType === 'breakdown',
    dashboardFilters,
  });

  const tableResults = tableQueryResult?.tableResults;
  const tableLoading = tableQueryResult?.loading ?? false;

  const errorDisplay =
    renderErrorMessage && errorMessage ? renderErrorMessage(errorMessage) : null;

  const colorPalette = useMemo(() => {
    const paletteSize = plottables.filter(plottable => plottable.needsColor).length;
    return paletteSize > 0 ? theme.chart.getColorPalette(paletteSize - 1) : [];
  }, [plottables, theme.chart]);

  const hasBreakdownData =
    widget.legendType === 'breakdown' &&
    timeseriesResults &&
    timeseriesResults.length > 0;

  const tableDataRows = tableResults?.[0]?.data;
  const tableErrorMessage = tableQueryResult?.errorMessage;
  const aggregates = widget.queries[0]?.aggregates ?? [];
  const columns = widget.queries[0]?.columns ?? [];

  // Filter out "Other" series for the legend breakdown
  const filteredSeriesWithIndex = hasBreakdownData
    ? timeseriesResults
        .map((series, index) => ({series, index}))
        .filter(({series}) => {
          return series.seriesName !== 'Other';
        })
    : [];

  const footerTable = hasBreakdownData ? (
    tableErrorMessage ? (
      <PanelAlert variant="danger">{tableErrorMessage}</PanelAlert>
    ) : (
      <WidgetFooterTable>
        {filteredSeriesWithIndex.map(({series, index}, filteredIndex) => {
          const plottable = plottables[index];

          let value: number | null = null;
          if (tableDataRows) {
            // If the there is one groupby and one aggregate, the table results will be
            // [{groupBy: 'value', aggregate: 123}. {groupBy: 'value', aggregate: 123}]
            if (columns.length === 1 && aggregates.length === 1) {
              const aggregate = aggregates[0];
              const row = tableDataRows[filteredIndex];
              // TODO: We should ideally match row[columns[0]] with the series, however series can have aliases
              if (aggregate && row?.[aggregate] !== undefined) {
                value = row[aggregate] as number;
              }
            }
            // If there is no groupby, and multiple aggregates, the table result will be
            // [{aggregate1: 123}, {aggregate2: 345}]
            else if (columns.length === 0 && aggregates.length > 1) {
              const aggregate = aggregates[index];
              const row = tableDataRows[0];
              if (aggregate && row?.[aggregate] !== undefined) {
                value = row[aggregate] as number;
              }
            }
          }
          const dataType = plottable?.dataType ?? FALLBACK_TYPE;
          const dataUnit = plottable?.dataUnit ?? undefined;
          const label = plottable?.label ?? series.seriesName;
          return (
            <Fragment key={series.seriesName}>
              <div>
                <SeriesColorIndicator
                  style={{
                    backgroundColor: colorPalette[index],
                  }}
                />
              </div>
              <Tooltip title={label} showOnlyOnOverflow>
                <SeriesNameCell>{label}</SeriesNameCell>
              </Tooltip>
              <Text>
                {value === null ? '—' : formatYAxisValue(value, dataType, dataUnit)}
              </Text>
            </Fragment>
          );
        })}
      </WidgetFooterTable>
    )
  ) : null;

  if (loading || (widget.legendType === 'breakdown' && tableLoading)) {
    return <TimeSeriesWidgetVisualization.LoadingPlaceholder />;
  }
  if (errorDisplay) {
    return errorDisplay;
  }

  if (hasBreakdownData) {
    return (
      <Flex direction="column" height="100%">
        <ChartWrapper>
          <TimeSeriesWidgetVisualization
            plottables={plottables}
            releases={releases}
            showReleaseAs={showReleaseAs}
            showLegend="never"
          />
        </ChartWrapper>
        <FooterWrapper>
          <FooterTableWrapper>{footerTable}</FooterTableWrapper>
        </FooterWrapper>
      </Flex>
    );
  }

  return (
    <TimeSeriesWidgetVisualization
      plottables={plottables}
      releases={releases}
      showReleaseAs={showReleaseAs}
    />
  );
}

const ChartWrapper = styled('div')`
  flex: 2;
  min-height: 0;
  overflow: hidden;
`;

const FooterWrapper = styled('div')`
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
  margin: 0 -${p => p.theme.space.xl} -${p => p.theme.space.lg} -${p => p.theme.space.xl};
  width: calc(100% + ${p => p.theme.space.xl} * 2);
  border-top: 1px solid ${p => p.theme.border};
`;

const FooterTableWrapper = styled('div')`
  flex: 1;
  min-height: 0;
  width: 100%;
  overflow-y: auto;
`;

const SeriesNameCell = styled('div')`
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;
