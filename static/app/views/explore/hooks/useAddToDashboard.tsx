import {useCallback} from 'react';

import {t} from 'sentry/locale';
import type {NewQuery} from 'sentry/types/organization';
import EventView from 'sentry/utils/discover/eventView';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import useRouter from 'sentry/utils/useRouter';
import {
  DashboardWidgetSource,
  DisplayType,
  WidgetType,
} from 'sentry/views/dashboards/types';
import {MAX_NUM_Y_AXES} from 'sentry/views/dashboards/widgetBuilder/buildSteps/yAxisStep/yAxisSelector';
import {handleAddQueryToDashboard} from 'sentry/views/discover/utils';
import {
  useExploreDataset,
  useExploreGroupBys,
  useExploreMode,
  useExploreQuery,
  useExploreSortBys,
  useExploreVisualizes,
} from 'sentry/views/explore/contexts/pageParamsContext';
import {Mode} from 'sentry/views/explore/contexts/pageParamsContext/mode';
import {formatSort} from 'sentry/views/explore/contexts/pageParamsContext/sortBys';
import {ChartType} from 'sentry/views/insights/common/components/chart';

export const CHART_TYPE_TO_DISPLAY_TYPE = {
  [ChartType.LINE]: DisplayType.LINE,
  [ChartType.BAR]: DisplayType.BAR,
  [ChartType.AREA]: DisplayType.AREA,
};

export function useAddToDashboard() {
  const location = useLocation();
  const router = useRouter();
  const {selection} = usePageFilters();
  const organization = useOrganization();

  const mode = useExploreMode();
  const dataset = useExploreDataset();
  const groupBys = useExploreGroupBys();
  const sortBys = useExploreSortBys();
  const visualizes = useExploreVisualizes();
  const query = useExploreQuery();

  const getEventView = useCallback(
    (visualizeIndex: number) => {
      const yAxes = visualizes[visualizeIndex]!.yAxes.slice(0, MAX_NUM_Y_AXES);

      let fields: any;
      if (mode === Mode.SAMPLES) {
        fields = [];
      } else {
        fields = [
          ...new Set([...groupBys, ...yAxes, ...sortBys.map(sort => sort.field)]),
        ].filter(Boolean);
      }

      const search = new MutableSearch(query);

      const discoverQuery: NewQuery = {
        name: t('Custom Widget'),
        fields,
        orderby: sortBys.map(formatSort),
        query: search.formatString(),
        version: 2,
        dataset,
        yAxis: yAxes,
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
        router,
        yAxis: eventView.yAxis,
        widgetType: WidgetType.SPANS,
        source: DashboardWidgetSource.TRACE_EXPLORER,
      });
    },
    [organization, location, getEventView, router]
  );

  return {
    addToDashboard,
  };
}
