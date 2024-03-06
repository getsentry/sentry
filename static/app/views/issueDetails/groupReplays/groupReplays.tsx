import {useEffect, useMemo} from 'react';
import styled from '@emotion/styled';
import type {Location} from 'history';

import * as Layout from 'sentry/components/layouts/thirds';
import {IconUser} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {Group, Organization} from 'sentry/types';
import {trackAnalytics} from 'sentry/utils/analytics';
import type EventView from 'sentry/utils/discover/eventView';
import useReplayCountForIssues from 'sentry/utils/replayCount/useReplayCountForIssues';
import useReplayList from 'sentry/utils/replays/hooks/useReplayList';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import useReplaysFromIssue from 'sentry/views/issueDetails/groupReplays/useReplaysFromIssue';
import ReplayTable from 'sentry/views/replays/replayTable';
import {ReplayColumn} from 'sentry/views/replays/replayTable/types';
import type {ReplayListLocationQuery} from 'sentry/views/replays/types';

type Props = {
  group: Group;
};

const VISIBLE_COLUMNS = [
  ReplayColumn.REPLAY,
  ReplayColumn.OS,
  ReplayColumn.BROWSER,
  ReplayColumn.DURATION,
  ReplayColumn.COUNT_ERRORS,
  ReplayColumn.ACTIVITY,
];

function GroupReplays({group}: Props) {
  const organization = useOrganization();
  const location = useLocation<ReplayListLocationQuery>();

  const {eventView, fetchError, isFetching, pageLinks} = useReplaysFromIssue({
    group,
    location,
    organization,
  });

  useEffect(() => {
    trackAnalytics('replay.render-issues-group-list', {
      project_id: group.project.id,
      platform: group.project.platform,
      organization,
    });
    // we only want to fire this event once
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!eventView) {
    return (
      <StyledLayoutPage withPadding>
        <ReplayTable
          fetchError={fetchError}
          isFetching={isFetching}
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
      group={group}
    />
  );
}

function GroupReplaysTable({
  eventView,
  organization,
  visibleColumns,
  group,
}: {
  eventView: EventView;
  group: Group;
  organization: Organization;
  pageLinks: string | null;
  visibleColumns: ReplayColumn[];
}) {
  const location = useMemo(() => ({query: {}}) as Location<ReplayListLocationQuery>, []);
  const {getReplayCountForIssue} = useReplayCountForIssues();

  const {replays, isFetching, fetchError} = useReplayList({
    eventView,
    location,
    organization,
    queryReferrer: 'issueReplays',
  });

  return (
    <StyledLayoutPage withPadding>
      <ReplayCountHeader>
        <StyledIconUser size="sm" />
        {t(
          'Replay captured %s users experiencing this issue across %s events.',
          getReplayCountForIssue(group.id, group.issueCategory),
          group.count
        )}
      </ReplayCountHeader>
      <ReplayTable
        fetchError={fetchError}
        isFetching={isFetching}
        replays={replays}
        sort={undefined}
        visibleColumns={visibleColumns}
        showDropdownFilters={false}
        group={group}
        showReplayPlayer
      />
    </StyledLayoutPage>
  );
}

const StyledLayoutPage = styled(Layout.Page)`
  box-shadow: 0px 0px 1px ${p => p.theme.gray200};
  background-color: ${p => p.theme.background};
`;

const ReplayCountHeader = styled('div')`
  display: flex;
  align-items: center;
  padding-bottom: ${p => 2 * p.theme.grid}px;
`;

const StyledIconUser = styled(IconUser)`
  margin-right: ${p => p.theme.grid}px;
  height: 16px;
  width: 16px;
`;

export default GroupReplays;
