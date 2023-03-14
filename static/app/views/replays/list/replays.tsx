import {Fragment, useMemo} from 'react';
import {browserHistory} from 'react-router';
import {useTheme} from '@emotion/react';

import * as Layout from 'sentry/components/layouts/thirds';
import Pagination from 'sentry/components/pagination';
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
import ReplaysFilters from 'sentry/views/replays/filters';
import ReplayOnboardingPanel from 'sentry/views/replays/list/replayOnboardingPanel';
import ReplayTable from 'sentry/views/replays/replayTable';
import {ReplayColumns} from 'sentry/views/replays/replayTable/types';
import type {ReplayListLocationQuery} from 'sentry/views/replays/types';
import {REPLAY_LIST_FIELDS} from 'sentry/views/replays/types';

function ReplaysList() {
  const location = useLocation<ReplayListLocationQuery>();
  const organization = useOrganization();
  const theme = useTheme();
  const hasRoomForColumns = useMedia(`(min-width: ${theme.breakpoints.small})`);

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

  const {replays, pageLinks, isFetching, fetchError} = useReplayList({
    eventView,
    location,
    organization,
  });

  const {hasSentOneReplay, fetching} = useHaveSelectedProjectsSentAnyReplayEvents();

  return (
    <Layout.Body>
      <Layout.Main fullWidth>
        <ReplaysFilters />
        {fetching ? null : hasSentOneReplay ? (
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
        ) : (
          <ReplayOnboardingPanel />
        )}
      </Layout.Main>
    </Layout.Body>
  );
}

export default ReplaysList;
