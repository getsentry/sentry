import {useCallback} from 'react';

import {t} from 'sentry/locale';
import type {NewQuery} from 'sentry/types/organization';
import EventView from 'sentry/utils/discover/eventView';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import useRouter from 'sentry/utils/useRouter';
import {WidgetType} from 'sentry/views/dashboards/types';
import {MAX_NUM_Y_AXES} from 'sentry/views/dashboards/widgetBuilder/buildSteps/yAxisStep/yAxisSelector';
import {handleAddQueryToDashboard} from 'sentry/views/discover/utils';
import {
  useExploreDataset,
  useExploreFields,
  useExploreGroupBys,
  useExploreMode,
  useExploreQuery,
  useExploreSortBys,
  useExploreVisualizes,
} from 'sentry/views/explore/contexts/pageParamsContext';
import {Mode} from 'sentry/views/explore/contexts/pageParamsContext/mode';
import {formatSort} from 'sentry/views/explore/contexts/pageParamsContext/sortBys';

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
  const sampleFields = useExploreFields();
  const query = useExploreQuery();

  const getEventView = useCallback(
    (visualizeIndex: number) => {
      const yAxes = visualizes[visualizeIndex]!.yAxes.slice(0, MAX_NUM_Y_AXES);

      let fields;
      if (mode === Mode.SAMPLES) {
        fields = sampleFields.filter(Boolean);
      } else {
        fields = [...groupBys, ...yAxes].filter(Boolean);
      }

      const search = new MutableSearch(query);

      const discoverQuery: NewQuery = {
        name: t('Custom Explore Widget'),
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
      return newEventView;
    },
    [visualizes, mode, sampleFields, groupBys, query, dataset, selection, sortBys]
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
      });
    },
    [organization, location, getEventView, router]
  );

  return {
    addToDashboard,
  };
}
