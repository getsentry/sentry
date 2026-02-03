import {Fragment, useMemo} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import trimStart from 'lodash/trimStart';

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
import {transformLegacySeriesToPlottables} from 'sentry/utils/timeSeries/transformLegacySeriesToPlottables';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import {useReleaseStats} from 'sentry/utils/useReleaseStats';
import {getDatasetConfig} from 'sentry/views/dashboards/datasetConfig/base';
import type {DashboardFilters, Widget} from 'sentry/views/dashboards/types';
import {DisplayType} from 'sentry/views/dashboards/types';
import type {TabularColumn} from 'sentry/views/dashboards/widgets/common/types';
import {formatYAxisValue} from 'sentry/views/dashboards/widgets/timeSeriesWidget/formatters/formatYAxisValue';
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

  const showLegendBreakdown = widget.legendType === 'breakdown';

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
            showLegendBreakdown={showLegendBreakdown}
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
  showLegendBreakdown?: boolean;
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
  showLegendBreakdown,
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
    enabled: showLegendBreakdown ?? false,
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
    showLegendBreakdown && timeseriesResults && timeseriesResults.length > 0;

  const tableDataRows = tableResults?.[0]?.data;
  const tableErrorMessage = tableQueryResult?.errorMessage;
  const aggregates = widget.queries[0]?.aggregates ?? [];
  const columns = widget.queries[0]?.columns ?? [];
  const hasGroupBy = columns.length > 0;

  const footerTable = hasBreakdownData ? (
    tableErrorMessage ? (
      <PanelAlert variant="danger">{tableErrorMessage}</PanelAlert>
    ) : (
      <WidgetFooterTable>
        {timeseriesResults.map((series, index) => {
          const plottable = plottables[index];

          let value: number | null = null;
          if (tableDataRows) {
            if (hasGroupBy) {
              // With group by: match by index (both timeseries and table are ordered by aggregate desc)
              const aggregate = aggregates[0];
              const row = tableDataRows[index];
              if (aggregate && row?.[aggregate] !== undefined) {
                value = row[aggregate] as number;
              }
            } else {
              // Without group by: single row with multiple aggregates
              const aggregate = aggregates[index];
              const row = tableDataRows[0];
              if (aggregate && row?.[aggregate] !== undefined) {
                value = row[aggregate] as number;
              }
            }
          }
          const dataType = plottable?.dataType ?? 'number';
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
              <div>
                {value === null ? '—' : formatYAxisValue(value, dataType, dataUnit)}
              </div>
            </Fragment>
          );
        })}
      </WidgetFooterTable>
    )
  ) : null;

  if (loading || (showLegendBreakdown && tableLoading)) {
    return <TimeSeriesWidgetVisualization.LoadingPlaceholder />;
  }
  if (errorDisplay) {
    return errorDisplay;
  }

  if (hasBreakdownData) {
    return (
      <VisualizationContainer>
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
      </VisualizationContainer>
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

const VisualizationContainer = styled('div')`
  display: flex;
  flex-direction: column;
  height: 100%;
`;

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
