import type {PageFilters} from 'sentry/types/core';
import type {Series} from 'sentry/types/echarts';
import type {AggregationOutputType, Sort} from 'sentry/utils/discover/fields';
import {useReleaseStats} from 'sentry/utils/useReleaseStats';
import type {DashboardFilters, Widget} from 'sentry/views/dashboards/types';
import type {TabularColumn} from 'sentry/views/dashboards/widgets/common/types';
import {TimeSeriesWidgetVisualization} from 'sentry/views/dashboards/widgets/timeSeriesWidget/timeSeriesWidgetVisualization';
import {Widget as CommonWidget} from 'sentry/views/dashboards/widgets/widget/widget';
import type {LoadableChartWidgetProps} from 'sentry/views/insights/common/components/widgets/types';

import {transformToPlottables} from './transformToPlottables';
import {WidgetCardDataLoader} from './widgetCardDataLoader';

interface CommonDashboardWidgetProps {
  selection: PageFilters;
  widget: Widget;
  chartGroup?: string;
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

/**
 * Renders a widget using the new TimeSeriesWidgetVisualization system.
 *
 * This component:
 * 1. Loads data using WidgetCardDataLoader
 * 2. Transforms the data into Plottables (if not provided)
 * 3. Renders using CommonWidget + TimeSeriesWidgetVisualization
 *
 * Usage:
 * ```tsx
 * {useNewVisualization({widget}) ? (
 *   <RenderNewWidgetVisualization
 *     widget={widget}
 *     selection={selection}
 *     // ... other props
 *   />
 * ) : (
 *   // Legacy rendering
 * )}
 * ```
 */
export function CommonDashboardWidget({
  widget,
  selection,
  dashboardFilters,
  onDataFetched,
  onDataFetchStart,
  tableItemLimit,
  renderErrorMessage,
  chartGroup,
  showReleaseAs = 'bubble',
}: CommonDashboardWidgetProps) {
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
      {({timeseriesResults, timeseriesResultsTypes, errorMessage, loading}) => {
        // Use custom plottables if provided, otherwise transform the data
        const plottables = transformToPlottables(
          timeseriesResults,
          timeseriesResultsTypes,
          widget
        );

        // Show error message if there's an error and rendering function is provided
        const errorDisplay =
          renderErrorMessage && errorMessage ? renderErrorMessage(errorMessage) : null;

        return (
          <CommonWidget
            Title={<CommonWidget.WidgetTitle title={widget.title} />}
            Visualization={
              errorDisplay || loading ? (
                errorDisplay
              ) : (
                <TimeSeriesWidgetVisualization
                  plottables={plottables}
                  releases={releases}
                  showReleaseAs={showReleaseAs}
                />
              )
            }
          />
        );
      }}
    </WidgetCardDataLoader>
  );
}
