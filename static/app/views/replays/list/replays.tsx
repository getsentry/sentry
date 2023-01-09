import {Fragment, useMemo} from 'react';
import {browserHistory} from 'react-router';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import Button from 'sentry/components/button';
import Pagination from 'sentry/components/pagination';
import {t} from 'sentry/locale';
import {PageContent} from 'sentry/styles/organization';
import EventView from 'sentry/utils/discover/eventView';
import {decodeScalar} from 'sentry/utils/queryString';
import {DEFAULT_SORT, REPLAY_LIST_FIELDS} from 'sentry/utils/replays/fetchReplayList';
import useReplayList from 'sentry/utils/replays/hooks/useReplayList';
import {useReplayOnboardingSidebarPanel} from 'sentry/utils/replays/hooks/useReplayOnboarding';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {useLocation} from 'sentry/utils/useLocation';
import useMedia from 'sentry/utils/useMedia';
import useOrganization from 'sentry/utils/useOrganization';
import ReplaysFilters from 'sentry/views/replays/filters';
import ReplayOnboardingPanel from 'sentry/views/replays/list/replayOnboardingPanel';
import ReplayTable from 'sentry/views/replays/replayTable';
import {ReplayColumns} from 'sentry/views/replays/replayTable/types';
import type {ReplayListLocationQuery} from 'sentry/views/replays/types';

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

  const {hasSentOneReplay, activateSidebar} = useReplayOnboardingSidebarPanel();

  return (
    <StyledPageContent>
      <ReplaysFilters />
      {hasSentOneReplay ? (
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
              browserHistory.push({
                pathname: path,
                query: {...searchQuery, cursor},
              });
            }}
          />
        </Fragment>
      ) : (
        <ReplayOnboardingPanel>
          <Button onClick={activateSidebar} priority="primary">
            {t('Get Started')}
          </Button>
          <Button
            href="https://docs.sentry.io/platforms/javascript/session-replay/"
            external
          >
            {t('Read Docs')}
          </Button>
        </ReplayOnboardingPanel>
      )}
    </StyledPageContent>
  );
}

const StyledPageContent = styled(PageContent)`
  box-shadow: 0px 0px 1px ${p => p.theme.gray200};
  background-color: ${p => p.theme.background};
`;

export default ReplaysList;
