import {Fragment, useMemo} from 'react';
import styled from '@emotion/styled';
import {Location} from 'history';

import {space} from 'sentry/styles/space';
import type {Organization} from 'sentry/types';
import EventView from 'sentry/utils/discover/eventView';
import useReplayList from 'sentry/utils/replays/hooks/useReplayList';
import {useHaveSelectedProjectsSentAnyReplayEvents} from 'sentry/utils/replays/hooks/useReplayOnboarding';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import {ReplayCardTable} from 'sentry/views/replays/replayTable';
import {ReplayColumn} from 'sentry/views/replays/replayTable/types';
import type {ReplayListLocationQuery} from 'sentry/views/replays/types';

function ReplaysErroneousDeadRageCards() {
  const location = useLocation<ReplayListLocationQuery>();
  const organization = useOrganization();

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
        range: '1d',
        projects: [],
        query: '',
        orderby: '-count_errors',
      },
      location
    );
  }, [location]);

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
        range: '2d',
        projects: [],
        query: '',
        orderby: '-count_dead_clicks',
      },
      location
    );
  }, [location]);

  const hasSessionReplay = organization.features.includes('session-replay');
  const hasDeadRageCards = organization.features.includes('replay-error-click-cards');
  const {hasSentOneReplay, fetching} = useHaveSelectedProjectsSentAnyReplayEvents();

  return hasSessionReplay && !fetching && hasSentOneReplay ? (
    hasDeadRageCards ? (
      <SplitCardContainer>
        <ReplaysErroneousTable
          eventView={eventViewErrors}
          location={location}
          organization={organization}
        />
        <ReplaysDeadRageTable
          eventView={eventViewDeadRage}
          location={location}
          organization={organization}
        />
      </SplitCardContainer>
    ) : null
  ) : null;
}

function ReplaysErroneousTable({
  eventView,
  location,
  organization,
}: {
  eventView: EventView;
  location: Location;
  organization: Organization;
}) {
  const {replays, isFetching, fetchError} = useReplayList({
    eventView,
    location,
    organization,
  });

  const visibleCols = [
    ReplayColumn.MOST_ERRONEOUS_REPLAYS,
    ReplayColumn.DURATION,
    ReplayColumn.COUNT_ERRORS,
    ReplayColumn.ACTIVITY,
  ];

  return (
    <Fragment>
      <ReplayCardTable
        fetchError={fetchError}
        isFetching={isFetching}
        replays={replays?.slice(0, 3)}
        sort={eventView.sorts[0]}
        visibleColumns={visibleCols}
      />
    </Fragment>
  );
}

function ReplaysDeadRageTable({
  eventView,
  location,
  organization,
}: {
  eventView: EventView;
  location: Location;
  organization: Organization;
}) {
  const {replays, isFetching, fetchError} = useReplayList({
    eventView,
    location,
    organization,
  });

  const visibleCols = [
    ReplayColumn.MOST_DEAD_CLICKS,
    ReplayColumn.COUNT_DEAD_CLICKS,
    ReplayColumn.COUNT_RAGE_CLICKS,
  ];

  return (
    <Fragment>
      <ReplayCardTable
        fetchError={fetchError}
        isFetching={isFetching}
        replays={replays?.slice(0, 3)}
        sort={eventView.sorts[0]}
        visibleColumns={visibleCols}
        headersSortable={false}
      />
    </Fragment>
  );
}

const SplitCardContainer = styled('div')`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: ${space(2)};
`;

export default ReplaysErroneousDeadRageCards;
