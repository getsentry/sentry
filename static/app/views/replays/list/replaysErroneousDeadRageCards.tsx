import {useMemo} from 'react';
import styled from '@emotion/styled';
import {Location} from 'history';

import {space} from 'sentry/styles/space';
import type {Organization} from 'sentry/types';
import EventView from 'sentry/utils/discover/eventView';
import useReplayList from 'sentry/utils/replays/hooks/useReplayList';
import {useHaveSelectedProjectsSentAnyReplayEvents} from 'sentry/utils/replays/hooks/useReplayOnboarding';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import ReplayTable from 'sentry/views/replays/replayTable';
import {ReplayColumn} from 'sentry/views/replays/replayTable/types';
import {ReplayListLocationQuery} from 'sentry/views/replays/types';

function ReplaysErroneousDeadRageCards() {
  const organization = useOrganization();
  const location = useLocation<ReplayListLocationQuery>();

  const newLocation = useMemo(() => {
    return {
      pathname: '',
      search: '',
      hash: '',
      state: '',
      action: 'PUSH' as const,
      key: '',
      query: {
        project: location.query.project,
        environment: location.query.environment,
        start: location.query.start,
        statsPeriod: location.query.statsPeriod,
        utc: location.query.utc,
        end: location.query.end,
      },
    };
  }, [
    location.query.project,
    location.query.environment,
    location.query.start,
    location.query.statsPeriod,
    location.query.utc,
    location.query.end,
  ]);

  const eventViewErrors = useMemo(() => {
    return EventView.fromNewQueryWithLocation(
      {
        id: '',
        name: '',
        version: 2,
        fields: [
          'activity',
          'duration',
          'count_errors',
          'id',
          'project_id',
          'user',
          'finished_at',
          'is_archived',
          'started_at',
        ],
        projects: [],
        query: 'count_errors:>0',
        orderby: '-count_errors',
      },
      newLocation
    );
  }, [newLocation]);

  const eventViewDeadRage = useMemo(() => {
    return EventView.fromNewQueryWithLocation(
      {
        id: '',
        name: '',
        version: 2,
        fields: [
          'activity',
          'duration',
          'count_dead_clicks',
          'count_rage_clicks',
          'id',
          'project_id',
          'user',
          'finished_at',
          'is_archived',
          'started_at',
        ],
        projects: [],
        query: 'count_rage_clicks:>0',
        orderby: '-count_rage_clicks',
      },
      newLocation
    );
  }, [newLocation]);

  const hasSessionReplay = organization.features.includes('session-replay');
  const hasDeadRageCards = organization.features.includes('replay-error-click-cards');
  const {hasSentOneReplay, fetching} = useHaveSelectedProjectsSentAnyReplayEvents();

  const deadRageCols = [
    ReplayColumn.MOST_RAGE_CLICKS,
    ReplayColumn.COUNT_DEAD_CLICKS,
    ReplayColumn.COUNT_RAGE_CLICKS,
  ];

  const errorCols = [
    ReplayColumn.MOST_ERRONEOUS_REPLAYS,
    ReplayColumn.DURATION,
    ReplayColumn.COUNT_ERRORS,
    ReplayColumn.ACTIVITY,
  ];

  return hasSessionReplay && !fetching && hasSentOneReplay ? (
    hasDeadRageCards ? (
      <SplitCardContainer>
        <CardTable
          eventView={eventViewErrors}
          location={newLocation}
          organization={organization}
          visibleColumns={errorCols}
        />
        <CardTable
          eventView={eventViewDeadRage}
          location={newLocation}
          organization={organization}
          visibleColumns={deadRageCols}
        />
      </SplitCardContainer>
    ) : null
  ) : null;
}

function CardTable({
  eventView,
  location,
  organization,
  visibleColumns,
}: {
  eventView: EventView;
  location: Location;
  organization: Organization;
  visibleColumns: ReplayColumn[];
}) {
  const {replays, isFetching, fetchError} = useReplayList({
    eventView,
    location,
    organization,
    perPage: 3,
  });

  return (
    <ReplayTable
      fetchError={fetchError}
      isFetching={isFetching}
      replays={replays}
      sort={undefined}
      visibleColumns={visibleColumns}
      saveLocation
    />
  );
}

const SplitCardContainer = styled('div')`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: ${space(2)};
`;

export default ReplaysErroneousDeadRageCards;
