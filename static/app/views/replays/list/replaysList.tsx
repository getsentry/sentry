import {Fragment, useMemo} from 'react';
import {browserHistory} from 'react-router';
import {useTheme} from '@emotion/react';
import {Location} from 'history';

import Pagination from 'sentry/components/pagination';
import type {Organization} from 'sentry/types';
import trackAdvancedAnalyticsEvent from 'sentry/utils/analytics/trackAdvancedAnalyticsEvent';
import EventView from 'sentry/utils/discover/eventView';
import {decodeScalar} from 'sentry/utils/queryString';
import {DEFAULT_SORT} from 'sentry/utils/replays/fetchReplayList';
import useReplayList from 'sentry/utils/replays/hooks/useReplayList';
import {useHaveSelectedProjectsSentAnyReplayEvents} from 'sentry/utils/replays/hooks/useReplayOnboarding';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {useLocation} from 'sentry/utils/useLocation';
import useMedia from 'sentry/utils/useMedia';
import useOrganization from 'sentry/utils/useOrganization';
import ReplayOnboardingPanel from 'sentry/views/replays/list/replayOnboardingPanel';
import ReplayTable from 'sentry/views/replays/replayTable';
import {ReplayColumns} from 'sentry/views/replays/replayTable/types';
import type {ReplayListLocationQuery} from 'sentry/views/replays/types';
import {REPLAY_LIST_FIELDS} from 'sentry/views/replays/types';

function ReplaysList() {
  const location = useLocation<ReplayListLocationQuery>();
  const organization = useOrganization();

  const eventView = useMemo(() => {
    const query = decodeScalar(location.query.query, '');
    const conditions = new MutableSearch(query);

    return EventView.fromNewQueryWithLocation(
      {
        id: '',
        name: '',
        version: 2,
        fields: REPLAY_LIST_FIELDS,
        projects: [],
        query: conditions.formatString(),
        orderby: decodeScalar(location.query.sort, DEFAULT_SORT),
      },
      location
    );
  }, [location]);

  const hasSessionReplay = organization.features.includes('session-replay');
  const {hasSentOneReplay, fetching} = useHaveSelectedProjectsSentAnyReplayEvents();

  return hasSessionReplay && !fetching && hasSentOneReplay ? (
    <ReplaysListTable
      eventView={eventView}
      location={location}
      organization={organization}
    />
  ) : (
    <ReplayOnboardingPanel />
  );
}

function ReplaysListTable({
  eventView,
  location,
  organization,
}: {
  eventView: EventView;
  location: Location;
  organization: Organization;
}) {
  const theme = useTheme();
  const hasRoomForColumns = useMedia(`(min-width: ${theme.breakpoints.small})`);

  const {replays, pageLinks, isFetching, fetchError} = useReplayList({
    eventView,
    location,
    organization,
  });

  return (
    <Fragment>
      <ReplayTable
        fetchError={fetchError}
        isFetching={isFetching}
        replays={replays}
        sort={eventView.sorts[0]}
        visibleColumns={[
          ReplayColumns.session,
          ...(hasRoomForColumns
            ? [ReplayColumns.projectId, ReplayColumns.startedAt]
            : []),
          ReplayColumns.duration,
          ReplayColumns.countErrors,
          ReplayColumns.activity,
        ]}
      />
      <Pagination
        pageLinks={pageLinks}
        onCursor={(cursor, path, searchQuery) => {
          trackAdvancedAnalyticsEvent('replay.list-paginated', {
            organization,
            direction: cursor?.endsWith(':1') ? 'prev' : 'next',
          });
          browserHistory.push({
            pathname: path,
            query: {...searchQuery, cursor},
          });
        }}
      />
    </Fragment>
  );
}

export default ReplaysList;
