import {Fragment, useCallback, useEffect} from 'react';
import styled from '@emotion/styled';
import type {Location} from 'history';

import {Button} from 'sentry/components/button';
import * as Layout from 'sentry/components/layouts/thirds';
import Placeholder from 'sentry/components/placeholder';
import {Provider as ReplayContextProvider} from 'sentry/components/replays/replayContext';
import {IconPlay, IconUser} from 'sentry/icons';
import {t, tn} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Group} from 'sentry/types/group';
import type {Organization} from 'sentry/types/organization';
import {trackAnalytics} from 'sentry/utils/analytics';
import {browserHistory} from 'sentry/utils/browserHistory';
import type EventView from 'sentry/utils/discover/eventView';
import useReplayCountForIssues from 'sentry/utils/replayCount/useReplayCountForIssues';
import useReplayList from 'sentry/utils/replays/hooks/useReplayList';
import useReplayReader from 'sentry/utils/replays/hooks/useReplayReader';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import useUrlParams from 'sentry/utils/useUrlParams';
import useAllMobileProj from 'sentry/views/replays/detail/useAllMobileProj';
import ReplayTable from 'sentry/views/replays/replayTable';
import {ReplayColumn} from 'sentry/views/replays/replayTable/types';
import type {ReplayListLocationQuery, ReplayListRecord} from 'sentry/views/replays/types';

import {ReplayClipPreviewWrapper} from './replayClipPreviewWrapper';
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

function GroupReplays({group}: Props) {
  const organization = useOrganization();
  const location = useLocation<ReplayListLocationQuery>();

  const {eventView, fetchError, isFetching, pageLinks} = useReplaysFromIssue({
    group,
    location,
    organization,
  });
  const {allMobileProj} = useAllMobileProj();

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
      <StyledLayoutPage withPadding>
        <ReplayCountHeader>
          <IconUser size="sm" />
          {isFetching ? (
            <Placeholder height="18px" width="400px" />
          ) : (
            t('No replay data available.')
          )}
        </ReplayCountHeader>
        <ReplayTable
          fetchError={fetchError}
          isFetching={isFetching}
          replays={[]}
          sort={undefined}
          visibleColumns={visibleColumns(allMobileProj)}
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
      visibleColumns={visibleColumns(allMobileProj)}
      group={group}
    />
  );
}

function GroupReplaysTableInner({
  children,
  organization,
  group,
  replaySlug,
  setSelectedReplayIndex,
  selectedReplayIndex,
  overlayContent,
  replays,
  pageLinks,
}: {
  children: React.ReactNode;
  group: Group;
  organization: Organization;
  pageLinks: string | null;
  replaySlug: string;
  replays: ReplayListRecord[] | undefined;
  selectedReplayIndex: number;
  setSelectedReplayIndex: (index: number) => void;
  overlayContent?: React.ReactNode;
}) {
  const orgSlug = organization.slug;
  const {fetching, replay} = useReplayReader({
    orgSlug,
    replaySlug,
    group,
  });
  const {allMobileProj} = useAllMobileProj();

  return (
    <ReplayContextProvider
      analyticsContext="replay_tab"
      isFetching={fetching}
      replay={replay}
      autoStart
    >
      <ReplayClipPreviewWrapper
        orgSlug={orgSlug}
        replaySlug={replaySlug}
        group={group}
        pageLinks={pageLinks}
        selectedReplayIndex={selectedReplayIndex}
        setSelectedReplayIndex={setSelectedReplayIndex}
        visibleColumns={[ReplayColumn.PLAY_PAUSE, ...visibleColumns(allMobileProj)]}
        overlayContent={overlayContent}
        replays={replays}
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
  pageLinks: string | null;
  visibleColumns: ReplayColumn[];
}) {
  const location = useLocation();
  const urlParams = useUrlParams();
  const {getReplayCountForIssue} = useReplayCountForIssues({
    statsPeriod: '90d',
  });

  const replayListData = useReplayList({
    eventView,
    location: locationForFetching,
    organization,
    queryReferrer: 'issueReplays',
  });
  const {replays} = replayListData;
  const {allMobileProj} = useAllMobileProj();

  const rawReplayIndex = urlParams.getParamValue('selected_replay_index');
  const selectedReplayIndex = parseInt(
    typeof rawReplayIndex === 'string' ? rawReplayIndex : '0',
    10
  );

  const setSelectedReplayIndex = useCallback(
    (index: number) => {
      browserHistory.replace({
        pathname: location.pathname,
        query: {...location.query, selected_replay_index: index},
      });
    },
    [location]
  );

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
      onClickPlay={setSelectedReplayIndex}
      fetchError={replayListData.fetchError}
      isFetching={replayListData.isFetching}
      replays={replays}
    />
  );

  const inner = selectedReplay ? (
    <GroupReplaysTableInner
      // Use key to force unmount/remount of component to reset the context and replay iframe
      key={selectedReplay.id}
      setSelectedReplayIndex={setSelectedReplayIndex}
      selectedReplayIndex={selectedReplayIndex}
      overlayContent={overlayContent}
      organization={organization}
      group={group}
      replaySlug={selectedReplay.id}
      pageLinks={replayListData.pageLinks}
      replays={replays}
    >
      {replayTable}
    </GroupReplaysTableInner>
  ) : (
    replayTable
  );

  return (
    <StyledLayoutPage withPadding>
      <ReplayCountHeader>
        <IconUser size="sm" />
        {t(
          'There are %s for this issue across %s.',
          tn('%s replay', '%s replays', replayCount ?? 0),
          tn('%s event', '%s events', group.count)
        )}
      </ReplayCountHeader>
      {inner}
    </StyledLayoutPage>
  );
}

const StyledLayoutPage = styled(Layout.Page)`
  box-shadow: 0px 0px 1px ${p => p.theme.gray200};
  background-color: ${p => p.theme.background};
  gap: ${space(2)};
`;

const ReplayCountHeader = styled('div')`
  display: flex;
  align-items: center;
  gap: ${space(1)};
`;

const OverlayText = styled('div')`
  font-size: ${p => p.theme.fontSizeExtraLarge};
`;

const UpNext = styled('div')`
  line-height: 0;
`;

export default GroupReplays;
