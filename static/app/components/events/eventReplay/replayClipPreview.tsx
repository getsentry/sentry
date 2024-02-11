import type {ComponentProps} from 'react';
import {useMemo, useRef, useState} from 'react';
import styled from '@emotion/styled';

import {Alert} from 'sentry/components/alert';
import {LinkButton} from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import ErrorBoundary from 'sentry/components/errorBoundary';
import {StaticReplayPreview} from 'sentry/components/events/eventReplay/staticReplayPreview';
import Panel from 'sentry/components/panels/panel';
import Placeholder from 'sentry/components/placeholder';
import {Flex} from 'sentry/components/profiling/flex';
import MissingReplayAlert from 'sentry/components/replays/alerts/missingReplayAlert';
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
import {IconDelete} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import getRouteStringFromRoutes from 'sentry/utils/getRouteStringFromRoutes';
import {TabKey} from 'sentry/utils/replays/hooks/useActiveReplayTab';
import useReplayReader from 'sentry/utils/replays/hooks/useReplayReader';
import type RequestError from 'sentry/utils/requestError/requestError';
import useRouteAnalyticsParams from 'sentry/utils/routeAnalytics/useRouteAnalyticsParams';
import useOrganization from 'sentry/utils/useOrganization';
import {useRoutes} from 'sentry/utils/useRoutes';
import useFullscreen from 'sentry/utils/window/useFullscreen';
import useIsFullscreen from 'sentry/utils/window/useIsFullscreen';
import {normalizeUrl} from 'sentry/utils/withDomainRequired';
import Breadcrumbs from 'sentry/views/replays/detail/breadcrumbs';
import BrowserOSIcons from 'sentry/views/replays/detail/browserOSIcons';
import FluidHeight from 'sentry/views/replays/detail/layout/fluidHeight';
import type {ReplayRecord} from 'sentry/views/replays/types';

type Props = {
  analyticsContext: string;
  eventTimestampMs: number;
  orgSlug: string;
  replaySlug: string;
  focusTab?: TabKey;
  fullReplayButtonProps?: Partial<ComponentProps<typeof LinkButton>>;
};

const CLIP_DURATION_BEFORE_EVENT = 5_000;
const CLIP_DURATION_AFTER_EVENT = 5_000;

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
}: {
  replayId: string;
  fullReplayButtonProps?: Partial<ComponentProps<typeof LinkButton>>;
}) {
  const routes = useRoutes();
  const organization = useOrganization();
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const {replay, currentTime} = useReplayContext();

  const fullscreenRef = useRef(null);
  const {toggle: toggleFullscreen} = useFullscreen({
    elementRef: fullscreenRef,
  });
  const isFullscreen = useIsFullscreen();

  const startOffsetMs = replay?.getStartOffsetMs() ?? 0;
  const fullReplayUrl = {
    pathname: normalizeUrl(`/organizations/${organization.slug}/replays/${replayId}/`),
    query: {
      referrer: getRouteStringFromRoutes(routes),
      t_main: TabKey.ERRORS,
      t: (currentTime + startOffsetMs) / 1000,
    },
  };

  return (
    <PlayerPanel>
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
              <ReplayPlayer />
            </StaticPanel>
          </PlayerContextContainer>
          {isFullscreen && isSidebarOpen ? <Breadcrumbs /> : null}
        </PlayerBreadcrumbContainer>
        <ErrorBoundary mini>
          <ButtonGrid>
            <ReplayPlayPauseButton priority="default" />
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
  eventTimestampMs,
  orgSlug,
  replaySlug,
  fullReplayButtonProps,
}: Props) {
  const clipWindow = useMemo(
    () => ({
      startTimestampMs: eventTimestampMs - CLIP_DURATION_BEFORE_EVENT,
      endTimestampMs: eventTimestampMs + CLIP_DURATION_AFTER_EVENT,
    }),
    [eventTimestampMs]
  );

  const {fetching, replay, replayRecord, fetchError, replayId} = useReplayReader({
    orgSlug,
    replaySlug,
    clipWindow,
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
      <StyledPlaceholder
        testId="replay-loading-placeholder"
        height="400px"
        width="100%"
      />
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
      isFetching={fetching}
      replay={replay}
      analyticsContext={analyticsContext}
    >
      <PlayerContainer data-test-id="player-container">
        {replay?.hasProcessingErrors() ? (
          <ReplayProcessingError processingErrors={replay.processingErrors()} />
        ) : (
          <ReplayPreviewPlayer
            replayId={replayId}
            fullReplayButtonProps={fullReplayButtonProps}
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

const PlayerContainer = styled(FluidHeight)`
  position: relative;
  max-height: 448px;
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

const StyledPlaceholder = styled(Placeholder)`
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

export default ReplayClipPreview;
