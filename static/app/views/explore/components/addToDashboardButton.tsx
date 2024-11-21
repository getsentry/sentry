import {useCallback, useMemo} from 'react';

import {Button} from 'sentry/components/button';
import {Tooltip} from 'sentry/components/tooltip';
import {IconDashboard} from 'sentry/icons';
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
import {useSorts} from 'sentry/views/explore/hooks/useSorts';
import {useUserQuery} from 'sentry/views/explore/hooks/useUserQuery';
import {useVisualizes} from 'sentry/views/explore/hooks/useVisualizes';
import {formatSort} from 'sentry/views/explore/tables/aggregatesTable';

interface AddToDashboardButtonProps {
  visualizeIndex: number;
}

export function AddToDashboardButton({visualizeIndex}: AddToDashboardButtonProps) {
  const location = useLocation();
  const router = useRouter();
  const {selection} = usePageFilters();
  const organization = useOrganization();

  const [resultMode] = useResultMode();
  const [dataset] = useDataset();
  const {groupBys} = useGroupBys();
  const [visualizes] = useVisualizes();
  const [sampleFields] = useSampleFields();
  const yAxes = useMemo(
    () => visualizes[visualizeIndex].yAxes.slice(0, MAX_NUM_Y_AXES),
    [visualizes, visualizeIndex]
  );
  const fields = useMemo(() => {
    if (resultMode === 'samples') {
      return sampleFields.filter(Boolean);
    }

    return [...groupBys, ...yAxes].filter(Boolean);
  }, [groupBys, resultMode, sampleFields, yAxes]);
  const [sorts] = useSorts({fields});
  const [query] = useUserQuery();

  const discoverQuery: NewQuery = useMemo(() => {
    const search = new MutableSearch(query);

    return {
      name: t('Custom Explore Widget'),
      fields,
      orderby: sorts.map(formatSort),
      query: search.formatString(),
      version: 2,
      dataset,
      yAxis: yAxes,
    };
  }, [dataset, fields, sorts, query, yAxes]);

  const eventView = useMemo(() => {
    const newEventView = EventView.fromNewQueryWithPageFilters(discoverQuery, selection);
    newEventView.dataset = dataset;
    return newEventView;
  }, [discoverQuery, selection, dataset]);

  const handleAddToDashboard = useCallback(() => {
    handleAddQueryToDashboard({
      organization,
      location,
      eventView,
      router,
      yAxis: eventView.yAxis,
      widgetType: WidgetType.SPANS,
    });
  }, [organization, location, eventView, router]);

  return (
    <Tooltip title={t('Add to Dashboard')}>
      <Button
        size="sm"
        icon={<IconDashboard />}
        onClick={handleAddToDashboard}
        aria-label={t('Add to Dashboard')}
        borderless
      />
    </Tooltip>
  );
}
