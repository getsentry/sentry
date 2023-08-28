import {Fragment, useMemo} from 'react';
import {browserHistory} from 'react-router';
import styled from '@emotion/styled';
import {Location} from 'history';

import {Button} from 'sentry/components/button';
import {IconClose, IconSearch} from 'sentry/icons';
import {t} from 'sentry/locale';
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

  const eventViewDead = useMemo(() => {
    return EventView.fromNewQueryWithLocation(
      {
        id: '',
        name: '',
        version: 2,
        fields: [
          'activity',
          'duration',
          'count_dead_clicks',
          'id',
          'project_id',
          'user',
          'finished_at',
          'is_archived',
          'started_at',
        ],
        projects: [],
        query: 'count_dead_clicks:>0',
        orderby: '-count_dead_clicks',
      },
      newLocation
    );
  }, [newLocation]);

  const eventViewRage = useMemo(() => {
    return EventView.fromNewQueryWithLocation(
      {
        id: '',
        name: '',
        version: 2,
        fields: [
          'activity',
          'duration',
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
  const {hasSentOneReplay, fetching} = useHaveSelectedProjectsSentAnyReplayEvents();

  const deadCols = [
    ReplayColumn.MOST_DEAD_CLICKS,
    ReplayColumn.COUNT_DEAD_CLICKS_NO_HEADER,
  ];

  const rageCols = [
    ReplayColumn.MOST_RAGE_CLICKS,
    ReplayColumn.COUNT_RAGE_CLICKS_NO_HEADER,
  ];

  return hasSessionReplay && hasSentOneReplay && !fetching ? (
    <SplitCardContainer>
      <CardTable
        eventView={eventViewDead}
        location={newLocation}
        organization={organization}
        visibleColumns={deadCols}
        searchQuery={{
          ...location.query,
          cursor: undefined,
          query: 'count_dead_clicks:>0',
          sort: '-count_dead_clicks',
        }}
        buttonLabel={t('Show all replays with dead clicks')}
      />
      <CardTable
        eventView={eventViewRage}
        location={newLocation}
        organization={organization}
        visibleColumns={rageCols}
        searchQuery={{
          ...location.query,
          cursor: undefined,
          query: 'count_rage_clicks:>0',
          sort: '-count_rage_clicks',
        }}
        buttonLabel={t('Show all replays with rage clicks')}
      />
    </SplitCardContainer>
  ) : null;
}

function CardTable({
  buttonLabel,
  eventView,
  location,
  organization,
  searchQuery,
  visibleColumns,
}: {
  buttonLabel: string;
  eventView: EventView;
  location: Location;
  organization: Organization;
  searchQuery: {
    cursor: undefined;
    query: string;
    sort: string;
  };
  visibleColumns: ReplayColumn[];
}) {
  const {replays, isFetching, fetchError} = useReplayList({
    eventView,
    location,
    organization,
    perPage: 3,
  });

  const gridRows = new Array(replays ? (replays.length > 0 ? 3 : 1) : 1)
    .fill(' ')
    .map(_ => '1fr')
    .join(' ');

  const emptyLocation = useLocation();

  const emptySearchQuery = {
    ...emptyLocation.query,
    cursor: undefined,
    query: '',
    sort: '',
  };

  return (
    <Fragment>
      <ReplayTable
        fetchError={fetchError}
        isFetching={isFetching}
        replays={replays}
        sort={undefined}
        visibleColumns={visibleColumns}
        saveLocation
        gridRows={'auto ' + gridRows}
      />
      <StyledButton
        size="sm"
        onClick={() => {
          const newQuery =
            emptyLocation.query.query === searchQuery.query
              ? emptySearchQuery
              : searchQuery;
          browserHistory.push({
            pathname: emptyLocation.pathname,
            query: newQuery,
          });
        }}
        icon={
          emptyLocation.query.query === searchQuery.query ? (
            <IconClose size="xs" />
          ) : (
            <IconSearch size="xs" />
          )
        }
      >
        {emptyLocation.query.query === searchQuery.query
          ? t('Clear filter')
          : buttonLabel}
      </StyledButton>
    </Fragment>
  );
}

const SplitCardContainer = styled('div')`
  display: grid;
  grid-template-columns: 1fr 1fr;
  grid-template-rows: max-content max-content;
  grid-auto-flow: column;
  gap: 0 ${space(2)};
  align-items: stretch;
`;

const StyledButton = styled(Button)`
  width: 100%;
  border-top: none;
  border-radius: ${p => p.theme.borderRadiusBottom};
  padding: ${space(3)};
`;

export default ReplaysErroneousDeadRageCards;
