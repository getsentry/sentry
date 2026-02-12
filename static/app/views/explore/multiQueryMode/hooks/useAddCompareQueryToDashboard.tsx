import {useCallback} from 'react';

import usePageFilters from 'sentry/components/pageFilters/usePageFilters';
import type {NewQuery} from 'sentry/types/organization';
import EventView from 'sentry/utils/discover/eventView';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import {
  DashboardWidgetSource,
  DEFAULT_WIDGET_NAME,
  WidgetType,
} from 'sentry/views/dashboards/types';
import {MAX_NUM_Y_AXES} from 'sentry/views/dashboards/widgetBuilder/hooks/useWidgetBuilderState';
import {handleAddQueryToDashboard} from 'sentry/views/discover/utils';
import {Mode} from 'sentry/views/explore/contexts/pageParamsContext/mode';
import {formatSort} from 'sentry/views/explore/contexts/pageParamsContext/sortBys';
import {determineDefaultChartType} from 'sentry/views/explore/contexts/pageParamsContext/visualizes';
import {CHART_TYPE_TO_DISPLAY_TYPE} from 'sentry/views/explore/hooks/useAddToDashboard';
import {
  getQueryMode,
  type ReadableExploreQueryParts,
} from 'sentry/views/explore/multiQueryMode/locationUtils';

export function useAddCompareQueryToDashboard(query: ReadableExploreQueryParts) {
  const organization = useOrganization();
  const {selection} = usePageFilters();
  const location = useLocation();

  const yAxes = query.yAxes.slice(0, MAX_NUM_Y_AXES);
  const groupBys = query.groupBys;
  const mode = getQueryMode(groupBys);
  const sortBys = query.sortBys;
  const qs = query.query;

  const getEventView = useCallback(() => {
    let fields: any;
    if (mode === Mode.SAMPLES) {
      fields = [];
    } else {
      fields = [
        ...new Set([...groupBys, ...yAxes, ...sortBys.map(sort => sort.field)]),
      ].filter(Boolean);
    }

    const search = new MutableSearch(qs);

    const discoverQuery: NewQuery = {
      name: DEFAULT_WIDGET_NAME,
      fields,
      orderby: sortBys.map(formatSort),
      query: search.formatString(),
      version: 2,
      dataset: DiscoverDatasets.SPANS,
      yAxis: yAxes,
      display:
        CHART_TYPE_TO_DISPLAY_TYPE[query.chartType || determineDefaultChartType(yAxes)],
    };

    const newEventView = EventView.fromNewQueryWithPageFilters(discoverQuery, selection);
    newEventView.dataset = DiscoverDatasets.SPANS;
    return newEventView;
  }, [groupBys, mode, qs, query.chartType, selection, sortBys, yAxes]);

  const addToDashboard = useCallback(() => {
    const eventView = getEventView();

    handleAddQueryToDashboard({
      organization,
      location,
      eventView,
      yAxis: eventView.yAxis,
      widgetType: WidgetType.SPANS,
      source: DashboardWidgetSource.TRACE_EXPLORER,
    });
  }, [organization, location, getEventView]);

  return {
    addToDashboard,
  };
}
