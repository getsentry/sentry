import {Fragment, useMemo} from 'react';
import type {Location} from 'history';

import AnalyticsArea from 'sentry/components/analyticsArea';
import EmptyStateWarning from 'sentry/components/emptyStateWarning';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {t} from 'sentry/locale';
import EventView from 'sentry/utils/discover/eventView';
import useReplayList from 'sentry/utils/replays/hooks/useReplayList';
import useOrganization from 'sentry/utils/useOrganization';
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
        <AnalyticsArea name="example-replays-list">
          {replays?.map(r => {
            return <ReplayCell key={r.id} replay={r} rowIndex={0} />;
          })}
        </AnalyticsArea>
      )}
    </Fragment>
  );
}
