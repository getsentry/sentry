import {Fragment, useMemo} from 'react';
import {Location} from 'history';

import EmptyStateWarning from 'sentry/components/emptyStateWarning';
import {t} from 'sentry/locale';
import EventView from 'sentry/utils/discover/eventView';
import getRouteStringFromRoutes from 'sentry/utils/getRouteStringFromRoutes';
import useReplayList from 'sentry/utils/replays/hooks/useReplayList';
import useOrganization from 'sentry/utils/useOrganization';
import {useRoutes} from 'sentry/utils/useRoutes';
import {ReplayCell} from 'sentry/views/replays/replayTable/tableCell';

function transformSelectorQuery(selector: string) {
  return selector
    .replaceAll('"', `\\"`)
    .replaceAll('aria=', 'aria-label=')
    .replaceAll('testid=', 'data-test-id=');
}

export default function ExampleReplaysList({
  selector,
  location,
  clickType,
  deadOrRage,
}: {
  clickType: string;
  deadOrRage: string;
  location: Location;
  selector: string;
}) {
  const organization = useOrganization();
  const query = transformSelectorQuery(selector);
  const {project, environment, start, statsPeriod, utc, end} = location.query;
  const emptyLocation: Location = useMemo(() => {
    return {
      pathname: '',
      search: '',
      hash: '',
      state: '',
      action: 'PUSH' as const,
      key: '',
      query: {project, environment, start, statsPeriod, utc, end},
    };
  }, [project, environment, start, statsPeriod, utc, end]);

  const eventView = useMemo(
    () =>
      EventView.fromNewQueryWithLocation(
        {
          id: '',
          name: '',
          version: 2,
          fields: [
            'activity',
            'duration',
            'id',
            'project_id',
            'user',
            'finished_at',
            'is_archived',
            'started_at',
            'urls',
          ],
          projects: [],
          query: `${deadOrRage}.selector:"${query}"`,
          orderby: `-${clickType}`,
        },
        emptyLocation
      ),
    [emptyLocation, query, clickType, deadOrRage]
  );

  const {replays, isFetching, fetchError} = useReplayList({
    eventView,
    location: emptyLocation,
    organization,
    perPage: 3,
  });

  const routes = useRoutes();
  const referrer = getRouteStringFromRoutes(routes);

  return (
    <Fragment>
      {fetchError || (!isFetching && !replays?.length) ? (
        <EmptyStateWarning withIcon={false} small>
          {t('No replays found')}
        </EmptyStateWarning>
      ) : (
        replays?.map(r => {
          return (
            <ReplayCell
              key="session"
              replay={r}
              eventView={eventView}
              organization={organization}
              referrer={referrer}
              showUrl={false}
              referrer_table="main"
            />
          );
        })
      )}
    </Fragment>
  );
}
