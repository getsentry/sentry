import {Fragment, useMemo} from 'react';
import {Link} from 'react-router-dom';
import {useTheme} from '@emotion/react';

import {Container, Flex, type ContainerProps} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';
import {Tooltip} from '@sentry/scraps/tooltip';

import {IconWarning} from 'sentry/icons';
import type {PageFilters} from 'sentry/types/core';
import type {Series} from 'sentry/types/echarts';
import type {TableDataWithTitle} from 'sentry/utils/discover/discoverQuery';
import type {AggregationOutputType, DataUnit, Sort} from 'sentry/utils/discover/fields';
import {transformLegacySeriesToPlottables} from 'sentry/utils/timeSeries/transformLegacySeriesToPlottables';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import {useReleaseStats} from 'sentry/utils/useReleaseStats';
import {getDatasetConfig} from 'sentry/views/dashboards/datasetConfig/base';
import type {DashboardFilters, Widget} from 'sentry/views/dashboards/types';
import {usesTimeSeriesData} from 'sentry/views/dashboards/utils';
import {
  findLinkedDashboardForField,
  getLinkedDashboardUrl,
} from 'sentry/views/dashboards/utils/getLinkedDashboardUrl';
import {MISSING_DATA_MESSAGE} from 'sentry/views/dashboards/widgets/common/settings';
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
            dashboardFilters={dashboardFilters}
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
  dashboardFilters?: DashboardFilters;
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
  dashboardFilters,
}: VisualizationWidgetContentProps) {
  const theme = useTheme();
  const organization = useOrganization();
  const location = useLocation();

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
  const datasetConfig = getDatasetConfig(widget.widgetType);

  const tableDataRows = tableResults?.[0]?.data;
  const widgetQuery = widget.queries[0];
  const aggregates = widgetQuery?.aggregates ?? [];
  const columns = widgetQuery?.columns ?? [];

  // We only support one column for legend breakdown right now
  const firstColumn = columns[0];
  const linkedDashboard = findLinkedDashboardForField(widgetQuery, firstColumn);

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
          // If the there is one groupby and one aggregate, the table results will an array with multiple elemtents
          // [{groupBy: 'value', aggregate: 123}, {groupBy: 'value', aggregate: 123}]
          if (columns.length === 1 && aggregates.length === 1) {
            const aggregate = aggregates[0];
            const row = tableDataRows[filteredIndex];
            // TODO: We should ideally match row[columns[0]] with the series, however series can have aliases
            if (aggregate && row?.[aggregate] !== undefined) {
              value = row[aggregate] as number;
            }
          }
          // If there is no groupby, and multiple aggregates, the table result will be an array with a single element
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
        const linkedUrl =
          linkedDashboard && firstColumn && widget.widgetType
            ? getLinkedDashboardUrl({
                linkedDashboard,
                organizationSlug: organization.slug,
                field: firstColumn,
                value: series.seriesName,
                widgetType: widget.widgetType,
                dashboardFilters,
                locationQuery: location.query,
              })
            : undefined;

        const labelContent = linkedUrl ? (
          <Link to={linkedUrl}>{label}</Link>
        ) : (
          <Text>{label}</Text>
        );

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
              {labelContent}
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

  const timeseriesContainerPadding: ContainerProps = {
    paddingLeft: 'xl',
    paddingRight: 'xl',
    paddingBottom: 'lg',
  };

  if (showBreakdownData) {
    return (
      <Flex direction="column" height="100%">
        <Container overflow="hidden" flex={2} {...timeseriesContainerPadding}>
          <TimeSeriesWidgetVisualization
            plottables={plottables}
            releases={releases}
            showReleaseAs={showReleaseAs}
            showLegend="never"
            axisRange={datasetConfig.axisRange}
          />
        </Container>
        <Flex flex={1} direction="column" borderTop="primary">
          <Container flex={1} width="100%" overflowY="auto">
            {footerTable}
          </Container>
        </Flex>
      </Flex>
    );
  }

  return (
    <Container flex={1} {...timeseriesContainerPadding}>
      <TimeSeriesWidgetVisualization
        plottables={plottables}
        releases={releases}
        showReleaseAs={showReleaseAs}
        axisRange={datasetConfig.axisRange}
      />
    </Container>
  );
}
