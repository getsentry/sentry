import {Fragment, useMemo} from 'react';
import {Location} from 'history';

import EmptyStateWarning from 'sentry/components/emptyStateWarning';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {t} from 'sentry/locale';
import EventView from 'sentry/utils/discover/eventView';
import getRouteStringFromRoutes from 'sentry/utils/getRouteStringFromRoutes';
import useReplayList from 'sentry/utils/replays/hooks/useReplayList';
import useOrganization from 'sentry/utils/useOrganization';
import {useRoutes} from 'sentry/utils/useRoutes';
import {StatusContainer} from 'sentry/views/profiling/landing/styles';
import {ReplayCell} from 'sentry/views/replays/replayTable/tableCell';

export default function ExampleReplaysList({
  location,
  clickType,
  selectorQuery,
  projectId,
}: {
  clickType: 'count_dead_clicks' | 'count_rage_clicks';
  location: Location;
  projectId: number;
  selectorQuery: string;
}) {
  const organization = useOrganization();
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
          ],
          projects: [projectId],
          query: selectorQuery,
          orderby: `-${clickType}`,
        },
        emptyLocation
      ),
    [emptyLocation, selectorQuery, clickType, projectId]
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
      ) : isFetching ? (
        <StatusContainer>
          <LoadingIndicator />
        </StatusContainer>
      ) : (
        replays?.map(r => {
          return (
            <ReplayCell
              key={r.id}
              replay={r}
              eventView={eventView}
              organization={organization}
              referrer={referrer}
              referrer_table="selector-widget"
              isWidget
            />
          );
        })
      )}
    </Fragment>
  );
}
