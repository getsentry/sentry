import {useCallback, useMemo} from 'react';
import {useLocation} from 'sentry/utils/useLocation';
import {Button} from 'sentry/components/button';
import {Tooltip} from 'sentry/components/tooltip';
import {IconDashboard} from 'sentry/icons';
import {t} from 'sentry/locale';
import {NewQuery} from 'sentry/types/organization';
import EventView from 'sentry/utils/discover/eventView';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import {handleAddQueryToDashboard} from 'sentry/views/discover/utils';
import {useDataset} from 'sentry/views/explore/hooks/useDataset';
import {useGroupBys} from 'sentry/views/explore/hooks/useGroupBys';
import {useSorts} from 'sentry/views/explore/hooks/useSorts';
import {useUserQuery} from 'sentry/views/explore/hooks/useUserQuery';
import {useVisualizes} from 'sentry/views/explore/hooks/useVisualizes';
import {formatSort} from 'sentry/views/explore/tables/aggregatesTable';
import useRouter from 'sentry/utils/useRouter';

export function AddToDashboardButton() {
  const location = useLocation();
  const router = useRouter();
  const {selection} = usePageFilters();
  const organization = useOrganization();
  const [dataset] = useDataset();
  const {groupBys} = useGroupBys();
  const [visualizes] = useVisualizes();
  const fields = useMemo(() => {
    return [...groupBys, ...visualizes.flatMap(visualize => visualize.yAxes)].filter(
      Boolean
    );
  }, [groupBys, visualizes]);
  const [sorts] = useSorts({fields});
  const [query] = useUserQuery();

  const discoverQuery: NewQuery = useMemo(() => {
    const search = new MutableSearch(query);

    // Filtering out all spans with op like 'ui.interaction*' which aren't
    // embedded under transactions. The trace view does not support rendering
    // such spans yet.
    // TODO: Is this still needed? It doesn't show up in tags for the widget builder.
    // search.addFilterValues('!transaction.span_id', ['00']);

    return {
      name: t('Custom Explore Widget'),
      fields,
      orderby: sorts.map(formatSort),
      query: search.formatString(),
      version: 2,
      dataset,
      yAxis: visualizes.flatMap(visualize => visualize.yAxes.slice(0, 3)),
    };
  }, [dataset, fields, sorts, query]);

  const eventView = useMemo(() => {
    return EventView.fromNewQueryWithPageFilters(discoverQuery, selection);
  }, [discoverQuery, selection]);

  const handleAddToDashboard = useCallback(() => {
    handleAddQueryToDashboard({
      organization,
      location,
      eventView,
      router,
      yAxis: eventView.yAxis,
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
