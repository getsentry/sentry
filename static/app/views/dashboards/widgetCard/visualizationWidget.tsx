import {Fragment, useMemo} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import {Container, Flex} from '@sentry/scraps/layout';
import {Tooltip} from '@sentry/scraps/tooltip';

import type {PageFilters} from 'sentry/types/core';
import type {Series} from 'sentry/types/echarts';
import type {TableDataWithTitle} from 'sentry/utils/discover/discoverQuery';
import type {AggregationOutputType, DataUnit, Sort} from 'sentry/utils/discover/fields';
import {transformLegacySeriesToPlottables} from 'sentry/utils/timeSeries/transformLegacySeriesToPlottables';
import {useReleaseStats} from 'sentry/utils/useReleaseStats';
import type {DashboardFilters, Widget} from 'sentry/views/dashboards/types';
import {usesTimeSeriesData} from 'sentry/views/dashboards/utils';
import type {TabularColumn} from 'sentry/views/dashboards/widgets/common/types';
import {formatYAxisValue} from 'sentry/views/dashboards/widgets/timeSeriesWidget/formatters/formatYAxisValue';
import {FALLBACK_TYPE} from 'sentry/views/dashboards/widgets/timeSeriesWidget/settings';
import {TimeSeriesWidgetVisualization} from 'sentry/views/dashboards/widgets/timeSeriesWidget/timeSeriesWidgetVisualization';
import {TextAlignRight} from 'sentry/views/insights/common/components/textAlign';
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
        tableResults,
        errorMessage,
        loading,
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
  errorMessage?: string;
  renderErrorMessage?: (errorMessage?: string) => React.ReactNode;
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
}: VisualizationWidgetContentProps) {
  const theme = useTheme();

  const plottables = transformLegacySeriesToPlottables(
    timeseriesResults,
    timeseriesResultsTypes,
    timeseriesResultsUnits,
    widget
  );

  const errorDisplay =
    renderErrorMessage && errorMessage ? renderErrorMessage(errorMessage) : null;

  const colorPalette = useMemo(() => {
    const paletteSize = plottables.filter(plottable => plottable.needsColor).length;
    return paletteSize > 0 ? theme.chart.getColorPalette(paletteSize - 1) : [];
  }, [plottables, theme.chart]);

  const showBreakdownData =
    widget.legendType === 'breakdown' &&
    usesTimeSeriesData(widget.displayType) &&
    tableResults &&
    tableResults.length > 0;

  const tableDataRows = tableResults?.[0]?.data;
  const aggregates = widget.queries[0]?.aggregates ?? [];
  const columns = widget.queries[0]?.columns ?? [];

  // Filter out "Other" series for the legend breakdown
  const filteredSeriesWithIndex = showBreakdownData
    ? timeseriesResults
        .map((series, index) => ({series, index}))
        .filter(({series}) => {
          return series.seriesName !== 'Other';
        })
    : [];

  const footerTable = showBreakdownData ? (
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
            <Container>
              <SeriesColorIndicator
                style={{
                  backgroundColor: colorPalette[index],
                }}
              />
            </Container>
            <Tooltip title={label} showOnlyOnOverflow>
              <SeriesNameCell>{label}</SeriesNameCell>
            </Tooltip>
            <TextAlignRight>
              {value === null ? '—' : formatYAxisValue(value, dataType, dataUnit)}
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

  if (showBreakdownData) {
    return (
      <Flex direction="column" height="100%">
        <Container overflow="hidden" flex={2}>
          <TimeSeriesWidgetVisualization
            plottables={plottables}
            releases={releases}
            showReleaseAs={showReleaseAs}
            showLegend="never"
          />
        </Container>
        <FooterWrapper>
          <Container flex={1} width="100%" overflowY="auto">
            {footerTable}
          </Container>
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

const FooterWrapper = styled('div')`
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
  margin: 0 -${p => p.theme.space.xl} -${p => p.theme.space.lg} -${p => p.theme.space.xl};
  width: calc(100% + ${p => p.theme.space.xl} * 2);
  border-top: 1px solid ${p => p.theme.border};
`;

const SeriesNameCell = styled('div')`
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;
