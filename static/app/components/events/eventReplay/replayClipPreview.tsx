import {ComponentProps, Fragment, useMemo, useRef} from 'react';
import styled from '@emotion/styled';
import screenfull from 'screenfull';

import {Alert} from 'sentry/components/alert';
import {Button, LinkButton} from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import ErrorBoundary from 'sentry/components/errorBoundary';
import Placeholder from 'sentry/components/placeholder';
import {Flex} from 'sentry/components/profiling/flex';
import MissingReplayAlert from 'sentry/components/replays/alerts/missingReplayAlert';
import {
  Provider as ReplayContextProvider,
  useReplayContext,
} from 'sentry/components/replays/replayContext';
import ReplayPlayer from 'sentry/components/replays/replayPlayer';
import ReplayPlayPauseButton from 'sentry/components/replays/replayPlayPauseButton';
import ReplayProcessingError from 'sentry/components/replays/replayProcessingError';
import TimeAndScrubberGrid from 'sentry/components/replays/timeAndScrubberGrid';
import {IconContract, IconDelete, IconExpand} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import getRouteStringFromRoutes from 'sentry/utils/getRouteStringFromRoutes';
import {TabKey} from 'sentry/utils/replays/hooks/useActiveReplayTab';
import useReplayReader from 'sentry/utils/replays/hooks/useReplayReader';
import RequestError from 'sentry/utils/requestError/requestError';
import useRouteAnalyticsParams from 'sentry/utils/routeAnalytics/useRouteAnalyticsParams';
import useOrganization from 'sentry/utils/useOrganization';
import {useRoutes} from 'sentry/utils/useRoutes';
import useFullscreen from 'sentry/utils/window/useFullscreen';
import useIsFullscreen from 'sentry/utils/window/useIsFullscreen';
import {normalizeUrl} from 'sentry/utils/withDomainRequired';
import FluidHeight from 'sentry/views/replays/detail/layout/fluidHeight';
import {ReplayRecord} from 'sentry/views/replays/types';

type Props = {
  eventTimestampMs: number;
  orgSlug: string;
  replaySlug: string;
  focusTab?: TabKey;
  fullReplayButtonProps?: Partial<ComponentProps<typeof LinkButton>>;
};

const CLIP_DURATION_BEFORE_EVENT = 10_000;
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
  toggleFullscreen,
  replayId,
  fullReplayButtonProps,
}: {
  replayId: string;
  toggleFullscreen: () => void;
  fullReplayButtonProps?: Partial<ComponentProps<typeof LinkButton>>;
}) {
  const routes = useRoutes();
  const organization = useOrganization();
  const isFullscreen = useIsFullscreen();
  const {currentTime} = useReplayContext();

  // If the browser supports going fullscreen or not. iPhone Safari won't do
  // it. https://caniuse.com/fullscreen
  const showFullscreenButton = screenfull.isEnabled;

  const fullReplayUrl = {
    pathname: normalizeUrl(`/organizations/${organization.slug}/replays/${replayId}/`),
    query: {
      referrer: getRouteStringFromRoutes(routes),
      t_main: TabKey.ERRORS,
      t: currentTime / 1000,
    },
  };

  return (
    <Fragment>
      <StaticPanel>
        <ReplayPlayer />
      </StaticPanel>
      <ErrorBoundary mini>
        <ButtonGrid>
          <ReplayPlayPauseButton />
          <Container>
            <TimeAndScrubberGrid />
          </Container>
          <ButtonBar gap={1}>
            <LinkButton size="sm" to={fullReplayUrl}>
              {t('See Full Replay')}
            </LinkButton>
            {showFullscreenButton ? (
              <Button
                size="sm"
                title={isFullscreen ? t('Exit full screen') : t('Enter full screen')}
                aria-label={isFullscreen ? t('Exit full screen') : t('Enter full screen')}
                icon={
                  isFullscreen ? <IconContract size="sm" /> : <IconExpand size="sm" />
                }
                onClick={toggleFullscreen}
                {...fullReplayButtonProps}
              />
            ) : null}
          </ButtonBar>
        </ButtonGrid>
      </ErrorBoundary>
    </Fragment>
  );
}

function ReplayClipPreview({
  eventTimestampMs,
  orgSlug,
  replaySlug,
  fullReplayButtonProps,
}: Props) {
  const {fetching, replay, replayRecord, fetchError, replayId} = useReplayReader({
    orgSlug,
    replaySlug,
  });
  const fullscreenRef = useRef(null);
  const {toggle: toggleFullscreen} = useFullscreen({
    elementRef: fullscreenRef,
  });

  const startTimestampMs = replayRecord?.started_at?.getTime() ?? 0;
  const endTimestampMs = replayRecord?.finished_at?.getTime() ?? 0;
  const eventTimeOffsetMs = Math.abs(eventTimestampMs - startTimestampMs);
  const endTimeOffsetMs = Math.abs(endTimestampMs - startTimestampMs);

  useRouteAnalyticsParams({
    event_replay_status: getReplayAnalyticsStatus({fetchError, replayRecord}),
  });

  const clipStartTimeOffsetMs = Math.max(
    eventTimeOffsetMs - CLIP_DURATION_BEFORE_EVENT,
    0
  );
  const clipDurationMs =
    Math.min(eventTimeOffsetMs + CLIP_DURATION_AFTER_EVENT, endTimeOffsetMs) -
    clipStartTimeOffsetMs;

  const clipWindow = useMemo(
    () => ({
      startTimeOffsetMs: clipStartTimeOffsetMs,
      durationMs: clipDurationMs,
    }),
    [clipDurationMs, clipStartTimeOffsetMs]
  );
  const offset = useMemo(
    () => ({offsetMs: clipWindow.startTimeOffsetMs}),
    [clipWindow.startTimeOffsetMs]
  );

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

  return (
    <ReplayContextProvider
      isFetching={fetching}
      replay={replay}
      initialTimeOffsetMs={offset}
      clipWindow={clipWindow}
    >
      <PlayerContainer data-test-id="player-container" ref={fullscreenRef}>
        {replay?.hasProcessingErrors() ? (
          <ReplayProcessingError processingErrors={replay.processingErrors()} />
        ) : (
          <ReplayPreviewPlayer
            toggleFullscreen={toggleFullscreen}
            replayId={replayId}
            fullReplayButtonProps={fullReplayButtonProps}
          />
        )}
      </PlayerContainer>
    </ReplayContextProvider>
  );
}

const PlayerContainer = styled(FluidHeight)`
  position: relative;
  background: ${p => p.theme.background};
  gap: ${space(1)};
  max-height: 448px;
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

export default ReplayClipPreview;
