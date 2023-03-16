import {useMemo} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import {Location} from 'history';

import * as Layout from 'sentry/components/layouts/thirds';
import type {Group, Organization} from 'sentry/types';
import EventView from 'sentry/utils/discover/eventView';
import useReplayList from 'sentry/utils/replays/hooks/useReplayList';
import {useLocation} from 'sentry/utils/useLocation';
import useMedia from 'sentry/utils/useMedia';
import useOrganization from 'sentry/utils/useOrganization';
import useReplaysFromIssue from 'sentry/views/issueDetails/groupReplays/useReplaysFromIssue';
import ReplayTable from 'sentry/views/replays/replayTable';
import {ReplayColumns} from 'sentry/views/replays/replayTable/types';
import type {ReplayListLocationQuery} from 'sentry/views/replays/types';

type Props = {
  group: Group;
};

function GroupReplays({group}: Props) {
  const theme = useTheme();
  const hasRoomForColumns = useMedia(`(min-width: ${theme.breakpoints.small})`);
  const organization = useOrganization();
  const location = useLocation<ReplayListLocationQuery>();

  const {eventView, fetchError, pageLinks} = useReplaysFromIssue({
    group,
    location,
    organization,
  });

  if (!eventView) {
    return (
      <StyledLayoutPage withPadding>
        <ReplayTable
          fetchError={fetchError}
          isFetching
          replays={[]}
          sort={undefined}
          visibleColumns={[
            ReplayColumns.session,
            ...(hasRoomForColumns ? [ReplayColumns.startedAt] : []),
            ReplayColumns.duration,
            ReplayColumns.countErrors,
            ReplayColumns.activity,
          ]}
        />
      </StyledLayoutPage>
    );
  }
  return (
    <GroupReplaysTable
      eventView={eventView}
      organization={organization}
      pageLinks={pageLinks}
    />
  );
}

const GroupReplaysTable = ({
  eventView,
  organization,
}: {
  eventView: EventView;
  organization: Organization;
  pageLinks: string | null;
}) => {
  const location = useMemo(() => ({query: {}} as Location<ReplayListLocationQuery>), []);
  const theme = useTheme();
  const hasRoomForColumns = useMedia(`(min-width: ${theme.breakpoints.small})`);

  const {replays, isFetching, fetchError} = useReplayList({
    eventView,
    location,
    organization,
  });

  return (
    <StyledLayoutPage withPadding>
      <ReplayTable
        fetchError={fetchError}
        isFetching={isFetching}
        replays={replays}
        sort={undefined}
        visibleColumns={[
          ReplayColumns.session,
          ...(hasRoomForColumns ? [ReplayColumns.startedAt] : []),
          ReplayColumns.duration,
          ReplayColumns.countErrors,
          ReplayColumns.activity,
        ]}
      />
    </StyledLayoutPage>
  );
};

const StyledLayoutPage = styled(Layout.Page)`
  box-shadow: 0px 0px 1px ${p => p.theme.gray200};
  background-color: ${p => p.theme.background};
`;

export default GroupReplays;
