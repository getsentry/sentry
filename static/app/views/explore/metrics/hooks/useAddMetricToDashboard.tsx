import {useCallback} from 'react';

import {usePageFilters} from 'sentry/components/pageFilters/usePageFilters';
import type {NewQuery} from 'sentry/types/organization';
import {EventView} from 'sentry/utils/discover/eventView';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {useLocation} from 'sentry/utils/useLocation';
import {useOrganization} from 'sentry/utils/useOrganization';
import {
  DashboardWidgetSource,
  DEFAULT_WIDGET_NAME,
  WidgetType,
} from 'sentry/views/dashboards/types';
import {
  handleAddMultipleQueriesToDashboard,
  handleAddQueryToDashboard,
} from 'sentry/views/discover/utils';
import {CHART_TYPE_TO_DISPLAY_TYPE} from 'sentry/views/explore/hooks/useAddToDashboard';
import type {BaseMetricQuery} from 'sentry/views/explore/metrics/metricQuery';
import {isVisualize} from 'sentry/views/explore/queryParams/visualize';
import {visualizesToWidgetTransformations} from 'sentry/views/explore/utils/visualizesToWidgetTransformations';
import {ChartType} from 'sentry/views/insights/common/components/chart';

export function useAddMetricToDashboard() {
  const location = useLocation();
  const organization = useOrganization();
  const {selection} = usePageFilters();

  const getEventView = useCallback(
    (metricQuery: BaseMetricQuery) => {
      const queryValues = metricQuery?.queryParams;
      const visualizes = queryValues?.aggregateFields?.filter(isVisualize);
      const yAxes = visualizes?.map(v => v.yAxis);
      const fields = queryValues?.groupBys ?? [];
      const aggregateSortBys = queryValues?.aggregateSortBys ?? [];

      const search = new MutableSearch(queryValues?.query ?? '');

      const discoverQuery: NewQuery = {
        name: DEFAULT_WIDGET_NAME,
        fields,
        query: search.formatString(),
        version: 2,
        dataset: DiscoverDatasets.TRACEMETRICS,
        yAxis: yAxes,
      };

      const newEventView = EventView.fromNewQueryWithPageFilters(
        discoverQuery,
        selection
      );
      newEventView.display =
        CHART_TYPE_TO_DISPLAY_TYPE[visualizes?.[0]?.chartType ?? ChartType.LINE];

      if (fields.length > 0) {
        newEventView.sorts = aggregateSortBys;
      }
      return {
        eventView: newEventView,
        transformations: visualizesToWidgetTransformations(visualizes),
      };
    },
    [selection]
  );

  const addToDashboard = useCallback(
    (metricQuery: BaseMetricQuery | BaseMetricQuery[]) => {
      const queries = Array.isArray(metricQuery) ? metricQuery : [metricQuery];
      const dashboardQueries = queries.map(q => getEventView(q));

      if (dashboardQueries.length === 0) {
        return;
      }

      // For multiple queries, we need to call a different modal opener
      if (queries.length > 1) {
        handleAddMultipleQueriesToDashboard({
          organization,
          location,
          queries: dashboardQueries,
          widgetType: WidgetType.TRACEMETRICS,
          source: DashboardWidgetSource.TRACEMETRICS,
          selection,
        });
      } else {
        handleAddQueryToDashboard({
          organization,
          location,
          ...dashboardQueries[0]!,
          yAxis: dashboardQueries[0]!.eventView.yAxis,
          widgetType: WidgetType.TRACEMETRICS,
          source: DashboardWidgetSource.TRACEMETRICS,
        });
      }
    },
    [organization, location, getEventView, selection]
  );

  return {
    addToDashboard,
  };
}
