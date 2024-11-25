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
import {useDataset} from 'sentry/views/explore/hooks/useDataset';
import {useGroupBys} from 'sentry/views/explore/hooks/useGroupBys';
import {useResultMode} from 'sentry/views/explore/hooks/useResultsMode';
import {useSampleFields} from 'sentry/views/explore/hooks/useSampleFields';
import {getSorts} from 'sentry/views/explore/hooks/useSorts';
import {useUserQuery} from 'sentry/views/explore/hooks/useUserQuery';
import {useVisualizes} from 'sentry/views/explore/hooks/useVisualizes';
import {formatSort} from 'sentry/views/explore/tables/aggregatesTable';

export function useAddToDashboard() {
  const location = useLocation();
  const router = useRouter();
  const {selection} = usePageFilters();
  const organization = useOrganization();

  const [resultMode] = useResultMode();
  const [dataset] = useDataset();
  const {groupBys} = useGroupBys();
  const [visualizes] = useVisualizes();
  const [sampleFields] = useSampleFields();
  const [query] = useUserQuery();

  const getEventView = useCallback(
    (visualizeIndex: number) => {
      const yAxes = visualizes[visualizeIndex].yAxes.slice(0, MAX_NUM_Y_AXES);

      let fields;
      if (resultMode === 'samples') {
        fields = sampleFields.filter(Boolean);
      } else {
        fields = [...groupBys, ...yAxes].filter(Boolean);
      }

      const search = new MutableSearch(query);
      const sorts = getSorts(fields, location);

      const discoverQuery: NewQuery = {
        name: t('Custom Explore Widget'),
        fields,
        orderby: sorts.map(formatSort),
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
    [visualizes, resultMode, sampleFields, groupBys, query, location, dataset, selection]
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
