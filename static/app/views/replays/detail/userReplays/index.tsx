import {useMemo} from 'react';
import {browserHistory} from 'react-router';
import styled from '@emotion/styled';

import Pagination from 'sentry/components/pagination';
import Placeholder from 'sentry/components/placeholder';
import EventView from 'sentry/utils/discover/eventView';
import {DEFAULT_SORT, REPLAY_LIST_FIELDS} from 'sentry/utils/replays/fetchReplayList';
import useReplayList from 'sentry/utils/replays/hooks/useReplayList';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import FluidHeight from 'sentry/views/replays/detail/layout/fluidHeight';
import ReplayTable from 'sentry/views/replays/replayTable';
import {ReplayColumns} from 'sentry/views/replays/replayTable/types';
import type {ReplayRecord} from 'sentry/views/replays/types';

type Props = {
  user: undefined | ReplayRecord['user'];
};

function getUserCondition(user: undefined | ReplayRecord['user']) {
  if (user?.id) {
    return `user.id:${user.id}`;
  }
  if (user?.email) {
    return `user.email:${user.email}`;
  }
  if (user?.ip_address) {
    return `user.ip_address:${user.ip_address}`;
  }
  return '';
}

function ReplaysFromUser({user}: Props) {
  const eventView = useMemo(() => {
    const query = getUserCondition(user);
    if (!query) {
      return null;
    }
    return EventView.fromSavedQuery({
      id: '',
      name: '',
      version: 2,
      fields: REPLAY_LIST_FIELDS,
      projects: [],
      query,
      orderby: DEFAULT_SORT,
    });
  }, [user]);

  if (eventView) {
    return <TableWrapper eventView={eventView} />;
  }
  return <Placeholder height="100%" />;
}

function TableWrapper({eventView}) {
  const location = useLocation();
  const organization = useOrganization();
  const {replays, pageLinks, isFetching, fetchError} = useReplayList({
    eventView,
    location,
    organization,
  });

  return (
    <TableContainer>
      <ReplayTable
        isFetching={isFetching}
        fetchError={fetchError}
        replays={replays}
        sort={undefined}
        visibleColumns={[
          ReplayColumns.user,
          ReplayColumns.projectId,
          ReplayColumns.startedAt,
          ReplayColumns.duration,
          ReplayColumns.countErrors,
          ReplayColumns.activity,
        ]}
      />
      <StyledPagination
        pageLinks={pageLinks}
        onCursor={(cursor, path, searchQuery) => {
          browserHistory.push({
            pathname: path,
            query: {...searchQuery, cursor},
          });
        }}
      />
    </TableContainer>
  );
}

const TableContainer = styled(FluidHeight)`
  height: 100%;
`;

const StyledPagination = styled(Pagination)`
  margin-top: 0;
`;

export default ReplaysFromUser;
