import {Fragment, useCallback, useEffect, useMemo, useState} from 'react';
import styled from '@emotion/styled';
import type {Location} from 'history';

import {Button} from 'sentry/components/button';
import * as Layout from 'sentry/components/layouts/thirds';
import {StaticReplayPreferences} from 'sentry/components/replays/preferences/replayPreferences';
import {Provider as ReplayContextProvider} from 'sentry/components/replays/replayContext';
import {IconPlay, IconUser} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Group, Organization} from 'sentry/types';
import {trackAnalytics} from 'sentry/utils/analytics';
import {browserHistory} from 'sentry/utils/browserHistory';
import type EventView from 'sentry/utils/discover/eventView';
import useReplayCountForIssues from 'sentry/utils/replayCount/useReplayCountForIssues';
import useReplayList from 'sentry/utils/replays/hooks/useReplayList';
import useReplayReader from 'sentry/utils/replays/hooks/useReplayReader';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import useUrlParams from 'sentry/utils/useUrlParams';
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

const VISIBLE_COLUMNS_WITH_PLAY = [ReplayColumn.PLAY_PAUSE, ...VISIBLE_COLUMNS];

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
  group: Group;
  organization: Organization;
  pageLinks: string | null;
  replaySlug: string;
  selectedReplayIndex: number;
  setSelectedReplayIndex: (index: number) => void;
  overlayContent?: React.ReactNode;
} & ReturnType<typeof useReplayList>) {
  const orgSlug = organization.slug;
  const {fetching, replay} = useReplayReader({
    orgSlug,
    replaySlug,
    group,
  });

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
        group={group}
        pageLinks={props.pageLinks}
        selectedReplayIndex={props.selectedReplayIndex}
        setSelectedReplayIndex={props.setSelectedReplayIndex}
        visibleColumns={VISIBLE_COLUMNS_WITH_PLAY}
        overlayContent={props.overlayContent}
        replays={props.replays}
        isFetching={props.isFetching}
        fetchError={props.fetchError}
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
  const locationForFetching = useMemo(
    () => ({query: {}}) as Location<ReplayListLocationQuery>,
    []
  );
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

  // If the selected replay changes, we want to force the replay to hide to cause the
  // replay context to unmount and reset
  const [previousReplayIndex, setPreviousReplayIndex] =
    useState<number>(selectedReplayIndex);
  const [forceHideReplay, setForceHideReplay] = useState<boolean>(false);
  useEffect(() => {
    if (selectedReplayIndex !== previousReplayIndex) {
      setPreviousReplayIndex(selectedReplayIndex);
      setForceHideReplay(true);
    }
  }, [selectedReplayIndex, previousReplayIndex]);

  useEffect(() => {
    if (forceHideReplay) {
      setForceHideReplay(false);
    }
  }, [forceHideReplay]);

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

  const inner =
    selectedReplay && !forceHideReplay ? (
      <GroupReplaysTableInner
        setSelectedReplayIndex={setSelectedReplayIndex}
        selectedReplayIndex={selectedReplayIndex}
        overlayContent={overlayContent}
        organization={organization}
        group={group}
        replaySlug={selectedReplay.id}
        pageLinks={replayListData.pageLinks}
        fetchError={replayListData.fetchError}
        isFetching={replayListData.isFetching}
        replays={replays}
      />
    ) : (
      <ReplayTable
        sort={undefined}
        visibleColumns={VISIBLE_COLUMNS}
        showDropdownFilters={false}
        onClickPlay={setSelectedReplayIndex}
        fetchError={replayListData.fetchError}
        isFetching={replayListData.isFetching}
        replays={replays}
      />
    );

  return (
    <StyledLayoutPage withPadding>
      <ReplayCountHeader>
        <StyledIconUser size="sm" />
        {t(
          'Replay captured %s users experiencing this issue across %s events.',
          replayCount,
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
  gap: ${space(2)};
`;

const ReplayCountHeader = styled('div')`
  display: flex;
  align-items: center;
  gap: ${space(1)};
`;

const StyledIconUser = styled(IconUser)`
  margin-right: ${p => p.theme.grid}px;
  height: 16px;
  width: 16px;
`;

const OverlayText = styled('div')`
  font-size: ${p => p.theme.fontSizeExtraLarge};
`;

const UpNext = styled('div')`
  line-height: 0;
`;

export default GroupReplays;
