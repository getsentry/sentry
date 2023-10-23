import {useEffect, useMemo} from 'react';
import styled from '@emotion/styled';
import {Location} from 'history';

import * as Layout from 'sentry/components/layouts/thirds';
import {Event, type Group, IssueType, type Organization} from 'sentry/types';
import {trackAnalytics} from 'sentry/utils/analytics';
import EventView from 'sentry/utils/discover/eventView';
import useReplayList from 'sentry/utils/replays/hooks/useReplayList';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import useReplaysForRegressionIssue from 'sentry/views/issueDetails/groupReplays/useReplaysForRegressionIssue';
import useReplaysFromIssue from 'sentry/views/issueDetails/groupReplays/useReplaysFromIssue';
import ReplayTable from 'sentry/views/replays/replayTable';
import {ReplayColumn} from 'sentry/views/replays/replayTable/types';
import type {ReplayListLocationQuery} from 'sentry/views/replays/types';

type Props = {
  group: Group;
  event?: Event;
};

type BaseTableProps = {
  eventView: EventView | null;
  pageLinks: null;
  fetchError?: Error;
};

const VISIBLE_COLUMNS = [
  ReplayColumn.REPLAY,
  ReplayColumn.OS,
  ReplayColumn.BROWSER,
  ReplayColumn.DURATION,
  ReplayColumn.COUNT_ERRORS,
  ReplayColumn.ACTIVITY,
];

function BaseTable({eventView, fetchError, pageLinks}: BaseTableProps) {
  const organization = useOrganization();

  if (!eventView) {
    return (
      <StyledLayoutPage withPadding>
        <ReplayTable
          fetchError={fetchError}
          isFetching
          replays={[]}
          sort={undefined}
          visibleColumns={VISIBLE_COLUMNS}
          showDropdownFilters={false}
        />
      </StyledLayoutPage>
    );
  }
  return (
    <GroupReplaysTable
      eventView={eventView}
      organization={organization}
      pageLinks={pageLinks}
      visibleColumns={VISIBLE_COLUMNS}
    />
  );
}

function DefaultReplaysTable({group}: {group: Group}) {
  const organization = useOrganization();
  const location = useLocation();

  const {eventView, fetchError, pageLinks} = useReplaysFromIssue({
    group,
    location,
    organization,
  });

  return (
    <BaseTable eventView={eventView} fetchError={fetchError} pageLinks={pageLinks} />
  );
}

function RegressionReplaysTable({group, event}: {event: Event; group: Group}) {
  const organization = useOrganization();
  const location = useLocation();

  const {eventView, fetchError, pageLinks} = useReplaysForRegressionIssue({
    group,
    location,
    organization,
    event,
  });

  return (
    <BaseTable eventView={eventView} fetchError={fetchError} pageLinks={pageLinks} />
  );
}

function GroupReplays({group, event}: Props) {
  const organization = useOrganization();

  useEffect(() => {
    trackAnalytics('replay.render-issues-group-list', {
      project_id: group.project.id,
      platform: group.project.platform,
      organization,
    });
    // we only want to fire this event once
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (group.issueType === IssueType.PERFORMANCE_DURATION_REGRESSION && event) {
    return <RegressionReplaysTable group={group} event={event} />;
  }

  return <DefaultReplaysTable group={group} />;
}

function GroupReplaysTable({
  eventView,
  organization,
  visibleColumns,
}: {
  eventView: EventView;
  organization: Organization;
  pageLinks: string | null;
  visibleColumns: ReplayColumn[];
}) {
  const location = useMemo(() => ({query: {}}) as Location<ReplayListLocationQuery>, []);

  const {replays, isFetching, fetchError} = useReplayList({
    eventView,
    location,
    organization,
    queryReferrer: 'issueReplays',
  });

  return (
    <StyledLayoutPage withPadding>
      <ReplayTable
        fetchError={fetchError}
        isFetching={isFetching}
        replays={replays}
        sort={undefined}
        visibleColumns={visibleColumns}
        showDropdownFilters={false}
      />
    </StyledLayoutPage>
  );
}

const StyledLayoutPage = styled(Layout.Page)`
  box-shadow: 0px 0px 1px ${p => p.theme.gray200};
  background-color: ${p => p.theme.background};
`;

export default GroupReplays;
