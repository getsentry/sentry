import {Fragment} from 'react';
import {Link} from 'react-router-dom';
import {useTheme} from '@emotion/react';

import {Container, Flex, type ContainerProps} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';
import {Tooltip} from '@sentry/scraps/tooltip';

import type {PageFilters} from 'sentry/types/core';
import type {Series} from 'sentry/types/echarts';
import {defined} from 'sentry/utils';
import type {TableDataWithTitle} from 'sentry/utils/discover/discoverQuery';
import type {AggregationOutputType, DataUnit, Sort} from 'sentry/utils/discover/fields';
import {
  createPlottableFromTimeSeries,
  transformLegacySeriesToTimeSeries,
} from 'sentry/utils/timeSeries/transformLegacySeriesToPlottables';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import {useReleaseStats} from 'sentry/utils/useReleaseStats';
import type {DashboardFilters, Widget} from 'sentry/views/dashboards/types';
import {usesTimeSeriesData} from 'sentry/views/dashboards/utils';
import {
  findLinkedDashboardForField,
  getLinkedDashboardUrl,
} from 'sentry/views/dashboards/utils/getLinkedDashboardUrl';
import type {
  TabularColumn,
  TimeSeries,
} from 'sentry/views/dashboards/widgets/common/types';
import {formatYAxisValue} from 'sentry/views/dashboards/widgets/timeSeriesWidget/formatters/formatYAxisValue';
import type {Plottable} from 'sentry/views/dashboards/widgets/timeSeriesWidget/plottables/plottable';
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

  const timeSeriesWithPlottable: Array<[TimeSeries, Plottable]> = timeseriesResults
    .map(series => {
      const timeSeries = transformLegacySeriesToTimeSeries(
        series,
        timeseriesResultsTypes,
        timeseriesResultsUnits
      );
      if (!timeSeries) {
        return null;
      }
      const plottable = createPlottableFromTimeSeries(timeSeries, widget);
      if (!plottable) {
        return null;
      }
      return [timeSeries, plottable] satisfies [TimeSeries, Plottable];
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

  const tableDataRows = tableResults?.[0]?.data;
  const widgetQuery = widget.queries[0];
  const aggregates = widgetQuery?.aggregates ?? [];
  const columns = widgetQuery?.columns ?? [];

  // We only support one column for legend breakdown right now
  const firstColumn = columns[0];
  const linkedDashboard = findLinkedDashboardForField(widgetQuery, firstColumn);

  const footerTable = showBreakdownData ? (
    <WidgetFooterTable>
      {timeSeriesWithPlottable.map(([timeSeries, plottable], index) => {
        if (timeSeries.meta.isOther) {
          return null;
        }

        let value: number | null = null;
        if (tableDataRows) {
          // If the there is one column and one aggregate, the table results will an array with multiple elemtents
          // [{column: 'value', aggregate: 123}, {column: 'value', aggregate: 123}]
          if (columns.length === 1 && aggregates.length === 1) {
            const aggregate = aggregates[0];
            const row = tableDataRows[index];
            // TODO: We should ideally match row[columns[0]] with the series, however series can have aliases
            if (aggregate && row?.[aggregate] !== undefined) {
              value = row[aggregate] as number;
            }
          }
          // If there is no columns, and only aggregates, the table result will be an array with a single element
          // [{aggregate1: 123}, {aggregate2: 345}]
          else if (columns.length === 0 && aggregates.length > 1) {
            const aggregate = aggregates[index];
            const row = tableDataRows[0];
            if (aggregate && row?.[aggregate] !== undefined) {
              value = row[aggregate] as number;
            }
          }
        }
        const dataType = timeSeries.meta.valueType;
        const dataUnit = timeSeries.meta.valueUnit ?? undefined;
        const label = plottable?.label ?? timeSeries.yAxis;
        const linkedUrl =
          linkedDashboard && firstColumn && widget.widgetType
            ? getLinkedDashboardUrl({
                linkedDashboard,
                organizationSlug: organization.slug,
                field: firstColumn,
                value: timeSeries.yAxis, // TODO: when we migrate to the new time series data, we should grab this from `timeSeries.groupBy` instead, otherwise this will be incorrect
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
          <Fragment key={timeSeries.yAxis}>
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

  const timeseriesContainerPadding: ContainerProps = {
    paddingLeft: 'xl',
    paddingRight: 'xl',
    paddingBottom: 'lg',
  };

  const plottables = timeSeriesWithPlottable.map(([, plottable]) => plottable);

  if (showBreakdownData) {
    return (
      <Flex direction="column" height="100%">
        <Container overflow="hidden" flex={2} {...timeseriesContainerPadding}>
          <TimeSeriesWidgetVisualization
            plottables={plottables}
            releases={releases}
            showReleaseAs={showReleaseAs}
            showLegend="never"
          />
        </Container>
        <Flex flex={1} direction="column" borderTop="primary" overflowY="auto">
          <Container flex={1} width="100%">
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
      />
    </Container>
  );
}
