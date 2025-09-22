import {useCallback} from 'react';

import type {NewQuery} from 'sentry/types/organization';
import EventView from 'sentry/utils/discover/eventView';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import useRouter from 'sentry/utils/useRouter';
import {DashboardWidgetSource, WidgetType} from 'sentry/views/dashboards/types';
import {handleAddQueryToDashboard} from 'sentry/views/discover/utils';
import {CHART_TYPE_TO_DISPLAY_TYPE} from 'sentry/views/explore/hooks/useAddToDashboard';
import type {ChartType} from 'sentry/views/insights/common/components/chart';
import type {SpanFields} from 'sentry/views/insights/types';

export type AddToSpanDashboardOptions = {
  chartType: ChartType;
  widgetName: string;
  yAxes: string[];
  groupBy?: SpanFields[];
  search?: MutableSearch;
};

export const useAddToSpanDashboard = () => {
  const organization = useOrganization();
  const {selection} = usePageFilters();
  const location = useLocation();
  const router = useRouter();

  const addToSpanDashboard = useCallback(
    ({
      yAxes,
      groupBy = [],
      search = new MutableSearch(''),
      chartType,
      widgetName,
    }: AddToSpanDashboardOptions) => {
      const fields = [...groupBy, ...yAxes];
      const dataset = DiscoverDatasets.SPANS;

      const discoverQuery: NewQuery = {
        name: widgetName,
        fields,
        query: search.formatString(),
        version: 2,
        dataset,
        yAxis: yAxes,
      };

      const eventView = EventView.fromNewQueryWithPageFilters(discoverQuery, selection);
      eventView.dataset = dataset;
      eventView.display = CHART_TYPE_TO_DISPLAY_TYPE[chartType];

      handleAddQueryToDashboard({
        eventView,
        organization,
        yAxis: yAxes,
        query: discoverQuery,
        location,
        router,
        source: DashboardWidgetSource.INSIGHTS,
        widgetType: WidgetType.SPANS,
      });
    },
    [organization, selection, location, router]
  );

  return {
    addToSpanDashboard,
  };
};
