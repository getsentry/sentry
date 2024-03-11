import {useEffect, useMemo, useState} from 'react';
import styled from '@emotion/styled';
import type {Location} from 'history';

import * as Layout from 'sentry/components/layouts/thirds';
import {StaticReplayPreferences} from 'sentry/components/replays/preferences/replayPreferences';
import {Provider as ReplayContextProvider} from 'sentry/components/replays/replayContext';
import {IconUser} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Group, Organization} from 'sentry/types';
import {trackAnalytics} from 'sentry/utils/analytics';
import type EventView from 'sentry/utils/discover/eventView';
import useReplayCountForIssues from 'sentry/utils/replayCount/useReplayCountForIssues';
import useReplayList from 'sentry/utils/replays/hooks/useReplayList';
import useReplayReader from 'sentry/utils/replays/hooks/useReplayReader';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import ReplayTableWrapper from 'sentry/views/issueDetails/groupReplays/replayTableWrapper';
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

function GroupReplaysTableInner({
  organization,
  group,
  replaySlug,
  ...props
}: {
  organization: Organization;
  pageLinks: string | null;
  replaySlug: string;
  selectedReplayIndex: number;
  setSelectedReplayIndex: (index: number | undefined) => void;
  visibleColumns: ReplayColumn[];
  group?: Group;
  nextReplayText?: string;
} & ReturnType<typeof useReplayList>) {
  const orgSlug = organization.slug;
  const replayContext = useReplayReader({
    orgSlug,
    replaySlug,
    group,
  });
  const {fetching, replay} = replayContext;

  return (
    <ReplayContextProvider
      analyticsContext="replay_tab"
      isFetching={fetching}
      prefsStrategy={StaticReplayPreferences}
      replay={replay}
      autoStart
    >
      <ReplayTableWrapper
        orgSlug={orgSlug}
        replaySlug={replaySlug}
        sort={undefined}
        {...props}
      />
    </ReplayContextProvider>
  );
}

function GroupReplaysTable({
  eventView,
  organization,
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

  const replayListData = useReplayList({
    eventView,
    location,
    organization,
    queryReferrer: 'issueReplays',
  });
  const {replays} = replayListData;

  const [selectedReplayIndex, setSelectedReplayIndex] = useState<number | undefined>(0);
  const selectedReplay =
    selectedReplayIndex !== undefined ? replays?.[selectedReplayIndex] : undefined;

  const nextReplay =
    selectedReplayIndex !== undefined ? replays?.[selectedReplayIndex + 1] : undefined;
  const nextReplayText = nextReplay?.id
    ? `${nextReplay.user.display_name || t('Anonymous User')}`
    : undefined;

  const hasFeature = organization.features.includes('replay-play-from-replay-tab');

  const inner =
    hasFeature && selectedReplay && selectedReplayIndex !== undefined ? (
      <GroupReplaysTableInner
        setSelectedReplayIndex={setSelectedReplayIndex}
        selectedReplayIndex={selectedReplayIndex}
        nextReplayText={nextReplayText}
        visibleColumns={VISIBLE_COLUMNS}
        organization={organization}
        group={group}
        replaySlug={selectedReplay.id}
        {...replayListData}
      />
    ) : (
      <ReplayTable
        {...replayListData}
        sort={undefined}
        visibleColumns={VISIBLE_COLUMNS}
        showDropdownFilters={false}
        onClickPlay={hasFeature ? setSelectedReplayIndex : undefined}
      />
    );

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
      {inner}
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
  gap: ${space(1)};
`;

const StyledIconUser = styled(IconUser)`
  margin-right: ${p => p.theme.grid}px;
  height: 16px;
  width: 16px;
`;

export default GroupReplays;
