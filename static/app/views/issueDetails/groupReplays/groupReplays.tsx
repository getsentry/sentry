import {Fragment, useEffect} from 'react';
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
import type {Organization} from 'sentry/types/organization';
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

const visibleColumns = (allMobileProj: boolean) =>
  allMobileProj ? VISIBLE_COLUMNS_MOBILE : VISIBLE_COLUMNS;

function ReplayFilterMessage() {
  const hasStreamlinedUI = useHasStreamlinedUI();
  if (!hasStreamlinedUI) {
    return null;
  }
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

  if (!eventView) {
    // Shown on load and no replay data available
    return (
      <StyledLayoutPage withPadding hasStreamlinedUI={hasStreamlinedUI}>
        <ReplayHeader>
          <ReplayFilterMessage />
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
          visibleColumns={visibleColumns(isMobilePlatform)}
          showDropdownFilters={false}
        />
      </StyledLayoutPage>
    );
  }
  return (
    <SelectedReplayIndexProvider>
      <GroupReplaysTable
        eventView={eventView}
        organization={organization}
        group={group}
      />
    </SelectedReplayIndexProvider>
  );
}

function GroupReplaysTableInner({
  children,
  organization,
  group,
  replaySlug,
  overlayContent,
  replays,
}: {
  children: React.ReactNode;
  group: Group;
  organization: Organization;
  replaySlug: string;
  replays: ReplayListRecord[] | undefined;
  overlayContent?: React.ReactNode;
}) {
  const orgSlug = organization.slug;
  const readerResult = useLoadReplayReader({
    orgSlug,
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
            ? () => {
                setSelectedReplayIndex(selectedReplayIndex + 1);
              }
            : undefined
        }
        handleBackClick={
          selectedReplayIndex > 0
            ? () => {
                setSelectedReplayIndex(selectedReplayIndex - 1);
              }
            : undefined
        }
        analyticsContext="replay_tab"
      />
      {children}
    </ReplayContextProvider>
  );
}

const locationForFetching = {query: {}} as Location<ReplayListLocationQuery>;

function GroupReplaysTable({
  eventView,
  organization,
  group,
}: {
  eventView: EventView;
  group: Group;
  organization: Organization;
}) {
  const params = useParams<{groupId: string}>();
  const {getReplayCountForIssue} = useReplayCountForIssues({
    statsPeriod: '90d',
  });
  const hasStreamlinedUI = useHasStreamlinedUI();

  const replayListData = useReplayList({
    eventView,
    location: locationForFetching,
    organization,
    queryReferrer: 'issueReplays',
  });
  const {replays} = replayListData;
  const {allMobileProj} = useAllMobileProj({});

  const selectedReplayIndex = useSelectedReplayIndex();

  useCleanQueryParamsOnRouteLeave({
    fieldsToClean: ['selected_replay_index'],
    shouldClean: newLocation =>
      newLocation.pathname.includes(`/issues/${params.groupId}/`),
  });

  const {select: setSelectedReplayIndex} = useSelectReplayIndex();

  const selectedReplay = replays?.[selectedReplayIndex];

  const replayCount = getReplayCountForIssue(group.id, group.issueCategory);
  const nextReplay = replays?.[selectedReplayIndex + 1];
  const nextReplayText = nextReplay?.id
    ? `${nextReplay.user.display_name || t('Anonymous User')}`
    : undefined;

  const overlayContent =
    nextReplayText && replayCount && replayCount > 1 ? (
      <Fragment>
        <UpNext>{t('Up Next')}</UpNext>
        <OverlayText>{nextReplayText}</OverlayText>
        <Button
          onClick={() => {
            setSelectedReplayIndex(selectedReplayIndex + 1);
          }}
          icon={<IconPlay size="md" />}
          analyticsEventKey="issue_details.replay_tab.play_next_replay"
          analyticsEventName="Issue Details: Replay Tab Clicked Play Next Replay"
        >
          {t('Play Now')}
        </Button>
      </Fragment>
    ) : undefined;

  const replayTable = (
    <ReplayTable
      sort={undefined}
      visibleColumns={[
        ...(selectedReplay ? [ReplayColumn.PLAY_PAUSE] : []),
        ...visibleColumns(allMobileProj),
      ]}
      showDropdownFilters={false}
      onClickRow={setSelectedReplayIndex}
      fetchError={replayListData.fetchError}
      isFetching={replayListData.isFetching}
      replays={replays}
    />
  );

  const inner = selectedReplay ? (
    <GroupReplaysTableInner
      // Use key to force unmount/remount of component to reset the context and replay iframe
      key={selectedReplay.id}
      overlayContent={overlayContent}
      organization={organization}
      group={group}
      replaySlug={selectedReplay.id}
      replays={replays}
    >
      {replayTable}
    </GroupReplaysTableInner>
  ) : (
    replayTable
  );

  return (
    <StyledLayoutPage withPadding hasStreamlinedUI={hasStreamlinedUI}>
      <ReplayHeader>
        <ReplayFilterMessage />
        <ReplayCountHeader>
          <IconUser size="sm" />
          {(replayCount ?? 0) > 50
            ? tn(
                'There are 50+ replays for this issue across %s event',
                'There are 50+ replays for this issue across %s events',
                group.count
              )
            : t(
                'There %s for this issue across %s.',
                tn('is %s replay', 'are %s replays', replayCount ?? 0),
                tn('%s event', '%s events', group.count)
              )}
        </ReplayCountHeader>
      </ReplayHeader>
      {inner}
    </StyledLayoutPage>
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
