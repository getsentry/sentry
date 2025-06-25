import {Fragment, useEffect, useMemo} from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';
import type {Location} from 'history';

import {Button} from 'sentry/components/core/button';
import * as Layout from 'sentry/components/layouts/thirds';
import Placeholder from 'sentry/components/placeholder';
import {Provider as ReplayContextProvider} from 'sentry/components/replays/replayContext';
import {replayMobilePlatforms} from 'sentry/data/platformCategories';
import {IconPlay, IconUser} from 'sentry/icons';
import {t, tn} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Group} from 'sentry/types/group';
import {trackAnalytics} from 'sentry/utils/analytics';
import type EventView from 'sentry/utils/discover/eventView';
import useReplayCountForIssues from 'sentry/utils/replayCount/useReplayCountForIssues';
import useLoadReplayReader from 'sentry/utils/replays/hooks/useLoadReplayReader';
import useReplayList from 'sentry/utils/replays/hooks/useReplayList';
import useCleanQueryParamsOnRouteLeave from 'sentry/utils/useCleanQueryParamsOnRouteLeave';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import {useParams} from 'sentry/utils/useParams';
import GroupReplaysPlayer from 'sentry/views/issueDetails/groupReplays/groupReplaysPlayer';
import {
  SelectedReplayIndexProvider,
  useSelectedReplayIndex,
} from 'sentry/views/issueDetails/groupReplays/selectedReplayIndexContext';
import useSelectReplayIndex from 'sentry/views/issueDetails/groupReplays/useSelectReplayIndex';
import {useHasStreamlinedUI} from 'sentry/views/issueDetails/utils';
import useAllMobileProj from 'sentry/views/replays/detail/useAllMobileProj';
import ReplayTable from 'sentry/views/replays/replayTable';
import {ReplayColumn} from 'sentry/views/replays/replayTable/types';
import type {ReplayListLocationQuery, ReplayListRecord} from 'sentry/views/replays/types';

import useReplaysFromIssue from './useReplaysFromIssue';

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

const VISIBLE_COLUMNS_MOBILE = [
  ReplayColumn.REPLAY,
  ReplayColumn.OS,
  ReplayColumn.DURATION,
  ReplayColumn.COUNT_ERRORS,
  ReplayColumn.ACTIVITY,
];

function ReplayFilterMessage() {
  return (
    <ReplayFilterText>
      {t('The replays shown below are not subject to search filters.')}
      <StyledBreak />
    </ReplayFilterText>
  );
}

export default function GroupReplays({group}: Props) {
  const organization = useOrganization();
  const location = useLocation<ReplayListLocationQuery>();
  const hasStreamlinedUI = useHasStreamlinedUI();

  const {eventView, fetchError, isFetching} = useReplaysFromIssue({
    group,
    location,
    organization,
  });

  const isMobilePlatform = replayMobilePlatforms.includes(
    group.project.platform ?? 'other'
  );

  useEffect(() => {
    trackAnalytics('replay.render-issues-group-list', {
      project_id: group.project.id,
      platform: group.project.platform,
      organization,
    });
    // we only want to fire this event once
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const {getReplayCountForIssue} = useReplayCountForIssues({
    statsPeriod: '90d',
  });

  if (!eventView) {
    // Shown on load and no replay data available
    return (
      <StyledLayoutPage withPadding hasStreamlinedUI={hasStreamlinedUI}>
        <ReplayHeader>
          {hasStreamlinedUI ? <ReplayFilterMessage /> : null}
          <ReplayCountHeader>
            <IconUser size="sm" />
            {isFetching ? (
              <Placeholder height="18px" width="400px" />
            ) : (
              t('No replay data available.')
            )}
          </ReplayCountHeader>
        </ReplayHeader>
        <ReplayTable
          fetchError={fetchError}
          isFetching={isFetching}
          replays={[]}
          sort={undefined}
          visibleColumns={isMobilePlatform ? VISIBLE_COLUMNS_MOBILE : VISIBLE_COLUMNS}
          showDropdownFilters={false}
        />
      </StyledLayoutPage>
    );
  }

  const replayCount = getReplayCountForIssue(group.id, group.issueCategory) ?? 0;

  return (
    <SelectedReplayIndexProvider>
      <StyledLayoutPage withPadding hasStreamlinedUI={hasStreamlinedUI}>
        <ReplayHeader>
          {hasStreamlinedUI ? <ReplayFilterMessage /> : null}
          <ReplayCountHeader>
            <IconUser size="sm" />
            {replayCount > 50
              ? tn(
                  'There are 50+ replays for this issue across %s event',
                  'There are 50+ replays for this issue across %s events',
                  group.count
                )
              : t(
                  'There %s for this issue across %s.',
                  tn('is %s replay', 'are %s replays', replayCount),
                  tn('%s event', '%s events', group.count)
                )}
          </ReplayCountHeader>
        </ReplayHeader>

        <GroupReplaysTable
          eventView={eventView}
          group={group}
          replayCount={replayCount}
        />
      </StyledLayoutPage>
    </SelectedReplayIndexProvider>
  );
}

function SelectedReplayWrapper({
  children,
  group,
  replaySlug,
  overlayContent,
  replays,
}: {
  children: React.ReactNode;
  group: Group;
  overlayContent: React.ReactNode;
  replaySlug: string;
  replays: ReplayListRecord[] | undefined;
}) {
  const organization = useOrganization();
  const readerResult = useLoadReplayReader({
    orgSlug: organization.slug,
    replaySlug,
    group,
  });
  const {status, replay} = readerResult;

  const selectedReplayIndex = useSelectedReplayIndex();
  const {select: setSelectedReplayIndex} = useSelectReplayIndex();

  return (
    <ReplayContextProvider
      analyticsContext="replay_tab"
      isFetching={status === 'pending'}
      replay={replay}
      autoStart
    >
      <GroupReplaysPlayer
        replayReaderResult={readerResult}
        overlayContent={overlayContent}
        handleForwardClick={
          replays && selectedReplayIndex + 1 < replays.length
            ? () => setSelectedReplayIndex(selectedReplayIndex + 1)
            : undefined
        }
        handleBackClick={
          selectedReplayIndex > 0
            ? () => setSelectedReplayIndex(selectedReplayIndex - 1)
            : undefined
        }
        analyticsContext="replay_tab"
      />
      {children}
    </ReplayContextProvider>
  );
}

function GroupReplaysTable({
  eventView,
  group,
  replayCount,
}: {
  eventView: EventView;
  group: Group;
  replayCount: number;
}) {
  const organization = useOrganization();
  const {allMobileProj} = useAllMobileProj({});
  const selectedReplayIndex = useSelectedReplayIndex();
  const {select: setSelectedReplayIndex} = useSelectReplayIndex();

  const {groupId} = useParams<{groupId: string}>();
  useCleanQueryParamsOnRouteLeave({
    fieldsToClean: ['selected_replay_index'],
    shouldClean: newLocation => newLocation.pathname.includes(`/issues/${groupId}/`),
  });

  const replayListData = useReplayList({
    eventView,
    location: useMemo(() => ({query: {}}) as Location<ReplayListLocationQuery>, []),
    organization,
    queryReferrer: 'issueReplays',
  });
  const {replays} = replayListData;
  const selectedReplay = replays?.[selectedReplayIndex];

  const replayTable = (
    <ReplayTable
      sort={undefined}
      visibleColumns={[
        ...(selectedReplay ? [ReplayColumn.PLAY_PAUSE] : []),
        ...(allMobileProj ? VISIBLE_COLUMNS_MOBILE : VISIBLE_COLUMNS),
      ]}
      showDropdownFilters={false}
      onClickRow={setSelectedReplayIndex}
      fetchError={replayListData.fetchError}
      isFetching={replayListData.isFetching}
      replays={replays}
    />
  );

  if (selectedReplay) {
    return (
      <SelectedReplayWrapper
        // Use key to force unmount/remount of component to reset the context and replay iframe
        key={selectedReplay.id}
        overlayContent={<ReplayOverlay replayCount={replayCount} replays={replays} />}
        group={group}
        replaySlug={selectedReplay.id}
        replays={replays}
      >
        {replayTable}
      </SelectedReplayWrapper>
    );
  }
  return replayTable;
}

function ReplayOverlay({
  replayCount,
  replays,
}: {
  replayCount: number;
  replays: ReplayListRecord[];
}) {
  const selectedReplayIndex = useSelectedReplayIndex();
  const {select: setSelectedReplayIndex} = useSelectReplayIndex();

  const nextReplay = replays?.[selectedReplayIndex + 1];
  const nextReplayText = nextReplay?.id
    ? `${nextReplay.user.display_name || t('Anonymous User')}`
    : undefined;

  if (!nextReplayText || !replayCount) {
    return null;
  }

  return (
    <Fragment>
      <UpNext>{t('Up Next')}</UpNext>
      <OverlayText>{nextReplayText}</OverlayText>
      <Button
        onClick={() => setSelectedReplayIndex(selectedReplayIndex + 1)}
        icon={<IconPlay size="md" />}
        analyticsEventKey="issue_details.replay_tab.play_next_replay"
        analyticsEventName="Issue Details: Replay Tab Clicked Play Next Replay"
      >
        {t('Play Now')}
      </Button>
    </Fragment>
  );
}

const StyledLayoutPage = styled(Layout.Page)<{hasStreamlinedUI?: boolean}>`
  background-color: ${p => p.theme.background};
  gap: ${space(1.5)};

  ${p =>
    p.hasStreamlinedUI &&
    css`
      border: 1px solid ${p.theme.border};
      border-radius: ${p.theme.borderRadius};
      padding: ${space(1.5)};
    `}
`;

const ReplayCountHeader = styled('div')`
  display: flex;
  align-items: center;
  gap: ${space(1)};
`;

const ReplayHeader = styled('div')`
  display: flex;
  flex-direction: column;
`;

const StyledBreak = styled('hr')`
  margin-top: ${space(1)};
  margin-bottom: ${space(1.5)};
  border-color: ${p => p.theme.border};
`;

const ReplayFilterText = styled('div')`
  color: ${p => p.theme.subText};
`;

const OverlayText = styled('div')`
  font-size: ${p => p.theme.fontSizeExtraLarge};
`;

const UpNext = styled('div')`
  line-height: 0;
`;
