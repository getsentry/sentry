import type {PageFilters} from 'sentry/types/core';
import type {Series} from 'sentry/types/echarts';
import type {AggregationOutputType, Sort} from 'sentry/utils/discover/fields';
import {useReleaseStats} from 'sentry/utils/useReleaseStats';
import type {DashboardFilters, Widget} from 'sentry/views/dashboards/types';
import type {TabularColumn} from 'sentry/views/dashboards/widgets/common/types';
import {TimeSeriesWidgetVisualization} from 'sentry/views/dashboards/widgets/timeSeriesWidget/timeSeriesWidgetVisualization';
import {Widget as CommonWidget} from 'sentry/views/dashboards/widgets/widget/widget';
import type {LoadableChartWidgetProps} from 'sentry/views/insights/common/components/widgets/types';

import {transformLegacySeriesToPlottables} from './transformLegacySeriesToPlottables';
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
      {({timeseriesResults, timeseriesResultsTypes, errorMessage, loading}) => {
        const plottables = transformLegacySeriesToPlottables(
          timeseriesResults,
          timeseriesResultsTypes,
          widget
        );

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
