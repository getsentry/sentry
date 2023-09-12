import {Fragment, ReactNode, useMemo} from 'react';
import {browserHistory} from 'react-router';
import styled from '@emotion/styled';
import {Location} from 'history';
import repeat from 'lodash/repeat';

import {Button} from 'sentry/components/button';
import {IconClose, IconSearch} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
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

  const {project, environment, start, statsPeriod, utc, end} = location.query;
  const searchLocation = useMemo(() => {
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

  const hasSessionReplay = organization.features.includes('session-replay');
  const {hasSentOneReplay, fetching} = useHaveSelectedProjectsSentAnyReplayEvents();

  return hasSessionReplay && hasSentOneReplay && !fetching ? (
    <SplitCardContainer>
      <DeadClickTable searchLocation={searchLocation} />
      <RageClickTable searchLocation={searchLocation} />
    </SplitCardContainer>
  ) : null;
}

function DeadClickTable({searchLocation}: {searchLocation: Location}) {
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
        searchLocation
      ),
    [searchLocation]
  );

  return (
    <CardTable
      eventView={eventView}
      location={searchLocation}
      visibleColumns={[
        ReplayColumn.MOST_DEAD_CLICKS,
        ReplayColumn.COUNT_DEAD_CLICKS_NO_HEADER,
      ]}
    >
      <SearchButton
        eventView={eventView}
        label={t('Show all replays with dead clicks')}
      />
    </CardTable>
  );
}
function RageClickTable({searchLocation}: {searchLocation: Location}) {
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
        searchLocation
      ),
    [searchLocation]
  );

  return (
    <CardTable
      eventView={eventView}
      location={searchLocation}
      visibleColumns={[
        ReplayColumn.MOST_RAGE_CLICKS,
        ReplayColumn.COUNT_RAGE_CLICKS_NO_HEADER,
      ]}
    >
      <SearchButton
        eventView={eventView}
        label={t('Show all replays with rage clicks')}
      />
    </CardTable>
  );
}

function CardTable({
  children,
  eventView,
  location,
  visibleColumns,
}: {
  children: ReactNode;
  eventView: EventView;
  location: Location;
  visibleColumns: ReplayColumn[];
}) {
  const organization = useOrganization();
  const {replays, isFetching, fetchError} = useReplayList({
    eventView,
    location,
    organization,
    perPage: 3,
  });

  const length = replays?.length ?? 0;
  const rows = length > 0 ? 3 : 1;

  return (
    <Fragment>
      <ReplayTable
        fetchError={fetchError}
        isFetching={isFetching}
        replays={replays}
        sort={undefined}
        visibleColumns={visibleColumns}
        saveLocation
        gridRows={`auto ${repeat(' 1fr', rows)}`}
        showDropdownFilters={false}
      />
      {children}
    </Fragment>
  );
}

function SearchButton({eventView, label}: {eventView: EventView; label: ReactNode}) {
  const location = useLocation();
  const isActive = location.query.query === eventView.query;

  return (
    <StyledButton
      size="sm"
      onClick={() => {
        browserHistory.push({
          pathname: location.pathname,
          query: {
            ...location.query,
            cursor: undefined,
            query: isActive ? '' : eventView.query,
            sort: isActive ? '' : eventView.sorts[0].field,
          },
        });
      }}
      icon={isActive ? <IconClose size="xs" /> : <IconSearch size="xs" />}
    >
      {isActive ? t('Clear filter') : label}
    </StyledButton>
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
