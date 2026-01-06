import type {PageFilters} from 'sentry/types/core';
import type {Series} from 'sentry/types/echarts';
import type {AggregationOutputType, Sort} from 'sentry/utils/discover/fields';
import {
  mapAggregationTypeToValueTypeAndUnit,
  transformLegacySeriesToPlottables,
} from 'sentry/utils/timeSeries/transformLegacySeriesToPlottables';
import {useReleaseStats} from 'sentry/utils/useReleaseStats';
import type {DashboardFilters, Widget} from 'sentry/views/dashboards/types';
import type {
  AttributeValueType,
  AttributeValueUnit,
  TabularColumn,
} from 'sentry/views/dashboards/widgets/common/types';
import {TimeSeriesWidgetVisualization} from 'sentry/views/dashboards/widgets/timeSeriesWidget/timeSeriesWidgetVisualization';
import type {LoadableChartWidgetProps} from 'sentry/views/insights/common/components/widgets/types';

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
      dashboardFilters={dashboardFilters}
      selection={selection}
      onDataFetched={onDataFetched}
      onDataFetchStart={onDataFetchStart}
      tableItemLimit={tableItemLimit}
    >
      {({timeseriesResults, timeseriesResultsTypes = {}, errorMessage, loading}) => {
        const valueUnitResultTypes: Record<
          string,
          {valueType: AttributeValueType; valueUnit: AttributeValueUnit}
        > = {};
        Object.entries(timeseriesResultsTypes).forEach(([key, outputType]) => {
          valueUnitResultTypes[key] = mapAggregationTypeToValueTypeAndUnit(
            outputType,
            key
          );
        });

        widget.queries.forEach(query => {
          query.units?.forEach((unit, index) => {
            if (unit && query.fields) {
              valueUnitResultTypes[query.fields[index]!] = unit;
            }
          });
        });

        const firstUnit = widget.queries[0]?.units?.[0];

        if (
          firstUnit &&
          widget.queries?.[0]?.aggregates?.length === 1 &&
          widget.queries?.[0]?.columns?.length > 0
        ) {
          // if there's only one aggregate and more then one group by the series names are the name of the group, not the aggregate name
          // But we can just assume the units is for all the series
          timeseriesResults?.forEach(series => {
            valueUnitResultTypes[series.seriesName] = firstUnit;
          });
        }

        const plottables = transformLegacySeriesToPlottables(
          timeseriesResults,
          valueUnitResultTypes,
          widget
        );

        const errorDisplay =
          renderErrorMessage && errorMessage ? renderErrorMessage(errorMessage) : null;

        if (loading) {
          return <TimeSeriesWidgetVisualization.LoadingPlaceholder />;
        }
        if (errorDisplay) {
          return errorDisplay;
        }

        return (
          <TimeSeriesWidgetVisualization
            plottables={plottables}
            releases={releases}
            showReleaseAs={showReleaseAs}
          />
        );
      }}
    </WidgetCardDataLoader>
  );
}
