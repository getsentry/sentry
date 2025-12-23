import {useCallback} from 'react';

import type {NewQuery} from 'sentry/types/organization';
import EventView from 'sentry/utils/discover/eventView';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import {
  DashboardWidgetSource,
  DEFAULT_WIDGET_NAME,
  DisplayType,
  WidgetType,
} from 'sentry/views/dashboards/types';
import {handleAddQueryToDashboard} from 'sentry/views/discover/utils';
import type {BaseMetricQuery} from 'sentry/views/explore/metrics/metricQuery';
import {isVisualize} from 'sentry/views/explore/queryParams/visualize';
import {ChartType} from 'sentry/views/insights/common/components/chart';

export const CHART_TYPE_TO_DISPLAY_TYPE = {
  [ChartType.LINE]: DisplayType.LINE,
  [ChartType.BAR]: DisplayType.BAR,
  [ChartType.AREA]: DisplayType.AREA,
};

export function useAddMetricToDashboard() {
  const location = useLocation();
  const organization = useOrganization();
  const {selection} = usePageFilters();

  const getEventView = useCallback(
    (metricQuery: BaseMetricQuery) => {
      const queryValues = metricQuery?.queryParams;
      const visualize = queryValues?.aggregateFields?.find(isVisualize);
      const yAxis = visualize?.yAxis;
      const fields = queryValues?.groupBys ?? [];
      const aggregateSortBys = queryValues?.aggregateSortBys ?? [];

      const search = new MutableSearch(queryValues?.query ?? '');

      const discoverQuery: NewQuery = {
        name: DEFAULT_WIDGET_NAME,
        fields,
        query: search.formatString(),
        version: 2,
        dataset: DiscoverDatasets.TRACEMETRICS,
        yAxis: [yAxis ?? ''],
      };

      const newEventView = EventView.fromNewQueryWithPageFilters(
        discoverQuery,
        selection
      );
      newEventView.display =
        CHART_TYPE_TO_DISPLAY_TYPE[visualize?.chartType ?? ChartType.LINE];

      if (fields.length > 0) {
        newEventView.sorts = aggregateSortBys;
      }
      return newEventView;
    },
    [selection]
  );

  const addToDashboard = useCallback(
    (metricQuery: BaseMetricQuery) => {
      const eventView = getEventView(metricQuery);

      handleAddQueryToDashboard({
        organization,
        location,
        eventView,
        yAxis: eventView.yAxis,
        widgetType: WidgetType.TRACEMETRICS,
        source: DashboardWidgetSource.TRACEMETRICS,
      });
    },
    [organization, location, getEventView]
  );

  return {
    addToDashboard,
  };
}
