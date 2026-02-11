import {useCallback} from 'react';

import usePageFilters from 'sentry/components/pageFilters/usePageFilters';
import type {NewQuery} from 'sentry/types/organization';
import EventView from 'sentry/utils/discover/eventView';
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
import {Mode} from 'sentry/views/explore/contexts/pageParamsContext/mode';
import {formatSort} from 'sentry/views/explore/contexts/pageParamsContext/sortBys';
import {
  useQueryParamsAggregateSortBys,
  useQueryParamsGroupBys,
  useQueryParamsMode,
  useQueryParamsQuery,
  useQueryParamsSortBys,
  useQueryParamsVisualizes,
} from 'sentry/views/explore/queryParams/context';
import {useSpansDataset} from 'sentry/views/explore/spans/spansQueryParams';
import {ChartType} from 'sentry/views/insights/common/components/chart';

export const CHART_TYPE_TO_DISPLAY_TYPE = {
  [ChartType.LINE]: DisplayType.LINE,
  [ChartType.BAR]: DisplayType.BAR,
  [ChartType.AREA]: DisplayType.AREA,
};

export function useAddToDashboard() {
  const location = useLocation();
  const {selection} = usePageFilters();
  const organization = useOrganization();

  const mode = useQueryParamsMode();
  const dataset = useSpansDataset();
  const groupBys = useQueryParamsGroupBys();
  const sampleSortBys = useQueryParamsSortBys();
  const aggregateSortBys = useQueryParamsAggregateSortBys();
  const visualizes = useQueryParamsVisualizes();
  const query = useQueryParamsQuery();

  const sortBys = mode === Mode.SAMPLES ? sampleSortBys : aggregateSortBys;

  const getEventView = useCallback(
    (visualizeIndex: number) => {
      const yAxis = visualizes[visualizeIndex]!.yAxis;

      let fields: any;
      if (mode === Mode.SAMPLES) {
        fields = [];
      } else {
        fields = [
          ...new Set([...groupBys, yAxis, ...sortBys.map(sort => sort.field)]),
        ].filter(Boolean);
      }

      const search = new MutableSearch(query);

      const discoverQuery: NewQuery = {
        name: DEFAULT_WIDGET_NAME,
        fields,
        orderby: sortBys.map(formatSort),
        query: search.formatString(),
        version: 2,
        dataset,
        yAxis: [yAxis],
      };

      const newEventView = EventView.fromNewQueryWithPageFilters(
        discoverQuery,
        selection
      );
      newEventView.dataset = dataset;
      newEventView.display =
        CHART_TYPE_TO_DISPLAY_TYPE[visualizes[visualizeIndex]!.chartType];
      return newEventView;
    },
    [visualizes, mode, groupBys, query, dataset, selection, sortBys]
  );

  const addToDashboard = useCallback(
    (visualizeIndex: number) => {
      const eventView = getEventView(visualizeIndex);

      handleAddQueryToDashboard({
        organization,
        location,
        eventView,
        yAxis: eventView.yAxis,
        widgetType: WidgetType.SPANS,
        source: DashboardWidgetSource.TRACE_EXPLORER,
      });
    },
    [organization, location, getEventView]
  );

  return {
    addToDashboard,
  };
}
