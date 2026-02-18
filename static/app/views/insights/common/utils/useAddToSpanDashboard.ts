import {useCallback} from 'react';

import usePageFilters from 'sentry/components/pageFilters/usePageFilters';
import type {NewQuery} from 'sentry/types/organization';
import EventView from 'sentry/utils/discover/eventView';
import type {Sort} from 'sentry/utils/discover/fields';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {getIntervalForTimeSeriesQuery} from 'sentry/utils/timeSeries/getIntervalForTimeSeriesQuery';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import {
  DashboardWidgetSource,
  DEFAULT_WIDGET_NAME,
  DisplayType,
  WidgetType,
} from 'sentry/views/dashboards/types';
import {handleAddQueryToDashboard} from 'sentry/views/discover/utils';
import {CHART_TYPE_TO_DISPLAY_TYPE} from 'sentry/views/explore/hooks/useAddToDashboard';
import type {ChartType} from 'sentry/views/insights/common/components/chart';
import type {SpanFields} from 'sentry/views/insights/types';

export type AddToSpanDashboardOptions = {
  chartType: ChartType;
  yAxes: string[];
  groupBy?: SpanFields[];
  search?: MutableSearch;
  sort?: Sort;
  topEvents?: number;
  widgetName?: string;
};

export const useAddToSpanDashboard = () => {
  const organization = useOrganization();
  const {selection} = usePageFilters();
  const location = useLocation();

  const addToSpanDashboard = useCallback(
    ({
      yAxes,
      groupBy = [],
      search = new MutableSearch(''),
      chartType,
      widgetName,
      sort,
      topEvents,
    }: AddToSpanDashboardOptions) => {
      const fields = [...groupBy, ...yAxes];
      const dataset = DiscoverDatasets.SPANS;

      const discoverQuery: NewQuery = {
        name: widgetName ?? DEFAULT_WIDGET_NAME,
        fields,
        query: search.formatString(),
        version: 2,
        dataset,
        yAxis: yAxes,
      };

      const eventView = EventView.fromNewQueryWithPageFilters(discoverQuery, selection);
      eventView.dataset = dataset;
      eventView.display = CHART_TYPE_TO_DISPLAY_TYPE[chartType];
      eventView.interval = getIntervalForTimeSeriesQuery(yAxes, selection.datetime);

      if (sort) {
        eventView.sorts = [sort];
      }
      if (topEvents) {
        eventView.topEvents = topEvents.toString();
        eventView.display = DisplayType.TOP_N;
      }

      handleAddQueryToDashboard({
        eventView,
        organization,
        yAxis: yAxes,
        query: discoverQuery,
        location,
        source: DashboardWidgetSource.INSIGHTS,
        widgetType: WidgetType.SPANS,
      });
    },
    [organization, selection, location]
  );

  return {
    addToSpanDashboard,
  };
};
