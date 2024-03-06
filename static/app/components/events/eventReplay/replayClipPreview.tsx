import type {ComponentProps} from 'react';
import {useMemo, useRef, useState} from 'react';
import styled from '@emotion/styled';

import {Alert} from 'sentry/components/alert';
import {Button, LinkButton} from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import NegativeSpaceContainer from 'sentry/components/container/negativeSpaceContainer';
import ErrorBoundary from 'sentry/components/errorBoundary';
import {
  REPLAY_LOADING_HEIGHT,
  REPLAY_LOADING_HEIGHT_LARGE,
} from 'sentry/components/events/eventReplay/constants';
import {StaticReplayPreview} from 'sentry/components/events/eventReplay/staticReplayPreview';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import Panel from 'sentry/components/panels/panel';
import {Flex} from 'sentry/components/profiling/flex';
import MissingReplayAlert from 'sentry/components/replays/alerts/missingReplayAlert';
import {StaticReplayPreferences} from 'sentry/components/replays/preferences/replayPreferences';
import {
  Provider as ReplayContextProvider,
  useReplayContext,
} from 'sentry/components/replays/replayContext';
import ReplayCurrentUrl from 'sentry/components/replays/replayCurrentUrl';
import {ReplayFullscreenButton} from 'sentry/components/replays/replayFullscreenButton';
import ReplayPlayer from 'sentry/components/replays/replayPlayer';
import ReplayPlayPauseButton from 'sentry/components/replays/replayPlayPauseButton';
import ReplayProcessingError from 'sentry/components/replays/replayProcessingError';
import {ReplaySidebarToggleButton} from 'sentry/components/replays/replaySidebarToggleButton';
import TimeAndScrubberGrid from 'sentry/components/replays/timeAndScrubberGrid';
import {IconDelete, IconNext, IconPrevious} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {IssueCategory} from 'sentry/types';
import type {Group} from 'sentry/types/group';
import EventView from 'sentry/utils/discover/eventView';
import getRouteStringFromRoutes from 'sentry/utils/getRouteStringFromRoutes';
import {TabKey} from 'sentry/utils/replays/hooks/useActiveReplayTab';
import useReplayReader from 'sentry/utils/replays/hooks/useReplayReader';
import type RequestError from 'sentry/utils/requestError/requestError';
import useRouteAnalyticsParams from 'sentry/utils/routeAnalytics/useRouteAnalyticsParams';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import {useRoutes} from 'sentry/utils/useRoutes';
import useFullscreen from 'sentry/utils/window/useFullscreen';
import useIsFullscreen from 'sentry/utils/window/useIsFullscreen';
import {normalizeUrl} from 'sentry/utils/withDomainRequired';
import Breadcrumbs from 'sentry/views/replays/detail/breadcrumbs';
import BrowserOSIcons from 'sentry/views/replays/detail/browserOSIcons';
import FluidHeight from 'sentry/views/replays/detail/layout/fluidHeight';
import {ReplayCell} from 'sentry/views/replays/replayTable/tableCell';
import type {ReplayRecord} from 'sentry/views/replays/types';

type AdditionalProps =
  | {
      group: Group;
      clipOffsets?: undefined;
      eventTimestampMs?: undefined;
    }
  | {
      clipOffsets: {
        durationAfterMs: number;
        durationBeforeMs: number;
      };
      eventTimestampMs: number;
      group?: undefined;
    };

type Props = {
  analyticsContext: string;
  orgSlug: string;
  replaySlug: string;
  focusTab?: TabKey;
  fullReplayButtonProps?: Partial<ComponentProps<typeof LinkButton>>;
  handleBackClick?: () => void;
  handleForwardClick?: () => void;
  isLarge?: boolean;
  issueCategory?: IssueCategory;
  overlayText?: string;
} & AdditionalProps;

function getReplayAnalyticsStatus({
  fetchError,
  replayRecord,
}: {
  fetchError?: RequestError;
  replayRecord?: ReplayRecord;
}) {
  if (fetchError) {
    return 'error';
  }

  if (replayRecord?.is_archived) {
    return 'archived';
  }

  if (replayRecord) {
    return 'success';
  }

  return 'none';
}

function ReplayPreviewPlayer({
  replayId,
  fullReplayButtonProps,
  replayRecord,
  issueCategory,
  handleBackClick,
  handleForwardClick,
  overlayText,
}: {
  replayId: string;
  replayRecord: ReplayRecord;
  fullReplayButtonProps?: Partial<ComponentProps<typeof LinkButton>>;
  handleBackClick?: () => void;
  handleForwardClick?: () => void;
  issueCategory?: IssueCategory;
  overlayText?: string;
}) {
  const routes = useRoutes();
  const location = useLocation();
  const organization = useOrganization();
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const {replay, currentTime, isFinished, isPlaying} = useReplayContext();
  const eventView = EventView.fromLocation(location);

  const fullscreenRef = useRef(null);
  const {toggle: toggleFullscreen} = useFullscreen({
    elementRef: fullscreenRef,
  });
  const isFullscreen = useIsFullscreen();

  const startOffsetMs = replay?.getStartOffsetMs() ?? 0;
  const isRageClickIssue = issueCategory === IssueCategory.REPLAY;

  const fullReplayUrl = {
    pathname: normalizeUrl(`/organizations/${organization.slug}/replays/${replayId}/`),
    query: {
      referrer: getRouteStringFromRoutes(routes),
      t_main: isRageClickIssue ? TabKey.BREADCRUMBS : TabKey.ERRORS,
      t: (currentTime + startOffsetMs) / 1000,
      f_b_type: isRageClickIssue ? 'rageOrDead' : undefined,
    },
  };

  return (
    <PlayerPanel>
      {replayRecord && (
        <ReplayCellNoPadding
          key="session"
          replay={replayRecord}
          eventView={eventView}
          organization={organization}
          referrer="issue-details-replay-header"
        />
      )}
      <PreviewPlayerContainer ref={fullscreenRef} isSidebarOpen={isSidebarOpen}>
        <PlayerBreadcrumbContainer>
          <PlayerContextContainer>
            {isFullscreen ? (
              <ContextContainer>
                <ReplayCurrentUrl />
                <BrowserOSIcons />
                <ReplaySidebarToggleButton
                  isOpen={isSidebarOpen}
                  setIsOpen={setIsSidebarOpen}
                />
              </ContextContainer>
            ) : null}
            <StaticPanel>
              <ReplayPlayer overlayText={overlayText} />
            </StaticPanel>
          </PlayerContextContainer>
          {isFullscreen && isSidebarOpen ? <Breadcrumbs /> : null}
        </PlayerBreadcrumbContainer>
        <ErrorBoundary mini>
          <ButtonGrid>
            {handleBackClick && (
              <Button
                size="sm"
                title={t('Back')}
                icon={<IconPrevious />}
                onClick={() => handleBackClick()}
                aria-label={t('Back')}
              />
            )}
            <ReplayPlayPauseButton
              priority={isFinished || isPlaying ? 'primary' : 'default'}
            />
            {handleForwardClick && (
              <Button
                size="sm"
                title={t('Next')}
                icon={<IconNext />}
                onClick={() => handleForwardClick()}
                aria-label={t('Next')}
              />
            )}
            <Container>
              <TimeAndScrubberGrid />
            </Container>
            <ButtonBar gap={1}>
              <LinkButton size="sm" to={fullReplayUrl} {...fullReplayButtonProps}>
                {t('See Full Replay')}
              </LinkButton>
              <ReplayFullscreenButton toggleFullscreen={toggleFullscreen} />
            </ButtonBar>
          </ButtonGrid>
        </ErrorBoundary>
      </PreviewPlayerContainer>
    </PlayerPanel>
  );
}

function ReplayClipPreview({
  analyticsContext,
  clipOffsets,
  eventTimestampMs,
  orgSlug,
  replaySlug,
  fullReplayButtonProps,
  issueCategory,
  isLarge,
  handleForwardClick,
  handleBackClick,
  group,
  overlayText,
}: Props) {
  const clipWindow = useMemo(
    () =>
      clipOffsets && eventTimestampMs
        ? {
            startTimestampMs: eventTimestampMs - clipOffsets.durationBeforeMs,
            endTimestampMs: eventTimestampMs + clipOffsets.durationAfterMs,
          }
        : undefined,
    [clipOffsets, eventTimestampMs]
  );

  const {fetching, replay, replayRecord, fetchError, replayId} = useReplayReader({
    orgSlug,
    replaySlug,
    clipWindow,
    group,
  });

  useRouteAnalyticsParams({
    event_replay_status: getReplayAnalyticsStatus({fetchError, replayRecord}),
  });

  if (replayRecord?.is_archived) {
    return (
      <Alert type="warning" data-test-id="replay-error">
        <Flex gap={space(0.5)}>
          <IconDelete color="gray500" size="sm" />
          {t('The replay for this event has been deleted.')}
        </Flex>
      </Alert>
    );
  }

  if (fetchError) {
    return <MissingReplayAlert orgSlug={orgSlug} />;
  }

  if (fetching || !replayRecord || !replay) {
    return (
      <StyledNegativeSpaceContainer testId="replay-loading-placeholder" isLarge={isLarge}>
        <LoadingIndicator />
      </StyledNegativeSpaceContainer>
    );
  }

  if (replay.getDurationMs() <= 0) {
    return (
      <StaticReplayPreview
        analyticsContext={analyticsContext}
        isFetching={false}
        replay={replay}
        replayId={replayId}
        fullReplayButtonProps={fullReplayButtonProps}
        initialTimeOffsetMs={0}
      />
    );
  }

  return (
    <ReplayContextProvider
      analyticsContext={analyticsContext}
      isFetching={fetching}
      prefsStrategy={StaticReplayPreferences}
      replay={replay}
    >
      <PlayerContainer data-test-id="player-container" isLarge={isLarge}>
        {replay?.hasProcessingErrors() ? (
          <ReplayProcessingError processingErrors={replay.processingErrors()} />
        ) : (
          <ReplayPreviewPlayer
            replayId={replayId}
            fullReplayButtonProps={fullReplayButtonProps}
            replayRecord={replayRecord}
            issueCategory={issueCategory}
            handleBackClick={handleBackClick}
            handleForwardClick={handleForwardClick}
            overlayText={overlayText}
          />
        )}
      </PlayerContainer>
    </ReplayContextProvider>
  );
}

const PlayerPanel = styled(Panel)`
  padding: ${space(3)} ${space(3)} ${space(1.5)};
  margin: 0;
  display: flex;
  gap: ${space(1)};
  flex-direction: column;
  flex-grow: 1;
  overflow: hidden;
  height: 100%;
`;

const PlayerBreadcrumbContainer = styled(FluidHeight)`
  position: relative;
`;

const PreviewPlayerContainer = styled(FluidHeight)<{isSidebarOpen: boolean}>`
  gap: ${space(1)};
  background: ${p => p.theme.background};

  :fullscreen {
    padding: ${space(1)};

    ${PlayerBreadcrumbContainer} {
      display: grid;
      grid-template-columns: ${p => (p.isSidebarOpen ? '1fr 25%' : '1fr')};
      height: 100%;
      gap: ${space(1)};
    }
  }
`;

const PlayerContainer = styled(FluidHeight)<{isLarge?: boolean}>`
  position: relative;
  max-height: ${p =>
    p.isLarge ? REPLAY_LOADING_HEIGHT_LARGE : REPLAY_LOADING_HEIGHT + 16}px;
`;

const PlayerContextContainer = styled(FluidHeight)`
  display: flex;
  flex-direction: column;
  gap: ${space(1)};
`;

const StaticPanel = styled(FluidHeight)`
  border: 1px solid ${p => p.theme.border};
  border-radius: ${p => p.theme.borderRadius};
`;

const StyledNegativeSpaceContainer = styled(NegativeSpaceContainer)<{isLarge?: boolean}>`
  height: ${p => (p.isLarge ? REPLAY_LOADING_HEIGHT_LARGE : REPLAY_LOADING_HEIGHT)}px;
  margin-bottom: ${space(2)};
`;

const ButtonGrid = styled('div')`
  display: flex;
  align-items: center;
  gap: 0 ${space(2)};
  flex-direction: row;
  justify-content: space-between;
`;

const Container = styled('div')`
  display: flex;
  flex-direction: column;
  flex: 1 1;
  justify-content: center;
`;

const ContextContainer = styled('div')`
  display: grid;
  grid-auto-flow: column;
  grid-template-columns: 1fr max-content max-content;
  align-items: center;
  gap: ${space(1)};
`;

const ReplayCellNoPadding = styled(ReplayCell)`
  padding: 0 0 ${space(1)};
`;

export default ReplayClipPreview;
