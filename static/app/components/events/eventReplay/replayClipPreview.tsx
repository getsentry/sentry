import {Fragment, useMemo, useRef} from 'react';
import styled from '@emotion/styled';
import screenfull from 'screenfull';

import {Alert} from 'sentry/components/alert';
import {Button, LinkButton} from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import ErrorBoundary from 'sentry/components/errorBoundary';
import ExternalLink from 'sentry/components/links/externalLink';
import Link from 'sentry/components/links/link';
import List from 'sentry/components/list';
import ListItem from 'sentry/components/list/listItem';
import Placeholder from 'sentry/components/placeholder';
import {Flex} from 'sentry/components/profiling/flex';
import ReplayTimeline from 'sentry/components/replays/breadcrumbs/replayTimeline';
import {PlayerScrubber} from 'sentry/components/replays/player/scrubber';
import useScrubberMouseTracking from 'sentry/components/replays/player/useScrubberMouseTracking';
import {
  Provider as ReplayContextProvider,
  useReplayContext,
} from 'sentry/components/replays/replayContext';
import {ReplayPlayPauseBar} from 'sentry/components/replays/replayController';
import ReplayPlayer from 'sentry/components/replays/replayPlayer';
import ReplayProcessingError from 'sentry/components/replays/replayProcessingError';
import {formatTime} from 'sentry/components/replays/utils';
import {IconContract, IconDelete, IconExpand} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
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
};

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

function Controls({
  toggleFullscreen,
  replayId,
}: {
  replayId: string;
  toggleFullscreen: () => void;
}) {
  const routes = useRoutes();
  const organization = useOrganization();
  const isFullscreen = useIsFullscreen();
  const {replay, currentTime} = useReplayContext();

  // If the browser supports going fullscreen or not. iPhone Safari won't do
  // it. https://caniuse.com/fullscreen
  const showFullscreenButton = screenfull.isEnabled;

  const elem = useRef<HTMLDivElement>(null);
  const mouseTrackingProps = useScrubberMouseTracking({elem});

  const durationMs = replay?.getDurationMs() ?? 0;
  const fullReplayUrl = {
    pathname: normalizeUrl(`/organizations/${organization.slug}/replays/${replayId}/`),
    query: {
      referrer: getRouteStringFromRoutes(routes),
      t_main: TabKey.ERRORS,
      t: (currentTime + (replay?.getClipOffset() ?? 0)) / 1000,
    },
  };

  return (
    <ButtonGrid>
      <ReplayPlayPauseBar />
      <Container>
        <TimeAndScrubberGrid>
          <Time style={{gridArea: 'currentTime'}}>{formatTime(currentTime)}</Time>
          <div style={{gridArea: 'timeline'}}>
            <ReplayTimeline />
          </div>
          <StyledScrubber
            style={{gridArea: 'scrubber'}}
            ref={elem}
            {...mouseTrackingProps}
          >
            <PlayerScrubber showZoomIndicators />
          </StyledScrubber>
          <Time style={{gridArea: 'duration'}}>
            {durationMs ? formatTime(durationMs) : '--:--'}
          </Time>
        </TimeAndScrubberGrid>
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
            icon={isFullscreen ? <IconContract size="sm" /> : <IconExpand size="sm" />}
            onClick={toggleFullscreen}
          />
        ) : null}
      </ButtonBar>
    </ButtonGrid>
  );
}

function ReplayPreviewPlayer({
  toggleFullscreen,
  replayId,
}: {
  replayId: string;
  toggleFullscreen: () => void;
}) {
  return (
    <Fragment>
      <StaticPanel>
        <ReplayPlayer />
      </StaticPanel>
      <ErrorBoundary mini>
        <Controls toggleFullscreen={toggleFullscreen} replayId={replayId} />
      </ErrorBoundary>
    </Fragment>
  );
}

function ReplayClipPreview({eventTimestampMs, orgSlug, replaySlug}: Props) {
  const {fetching, replay, replayRecord, fetchError, replayId} = useReplayReader({
    orgSlug,
    replaySlug,
    clipWindow: {
      startTimestamp: eventTimestampMs - 10e3,
      endTimestamp: eventTimestampMs + 5e3,
    },
  });

  const fullscreenRef = useRef(null);
  const {toggle: toggleFullscreen} = useFullscreen({
    elementRef: fullscreenRef,
  });

  const startTimestampMs = replayRecord?.started_at?.getTime() ?? 0;
  const initialTimeOffsetMs = useMemo(() => {
    if (eventTimestampMs && startTimestampMs) {
      return Math.abs(eventTimestampMs - startTimestampMs);
    }

    return 0;
  }, [eventTimestampMs, startTimestampMs]);

  useRouteAnalyticsParams({
    event_replay_status: getReplayAnalyticsStatus({fetchError, replayRecord}),
  });

  const offset = useMemo(() => ({offsetMs: initialTimeOffsetMs}), [initialTimeOffsetMs]);

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
    const reasons = [
      t('The replay is still processing'),
      tct(
        'The replay was rate-limited and could not be accepted. [link:View the stats page] for more information.',
        {
          link: <Link to={`/organizations/${orgSlug}/stats/?dataCategory=replays`} />,
        }
      ),
      t('The replay has been deleted by a member in your organization.'),
      t('There were network errors and the replay was not saved.'),
      tct('[link:Read the docs] to understand why.', {
        link: (
          <ExternalLink href="https://docs.sentry.io/platforms/javascript/session-replay/#error-linking" />
        ),
      }),
    ];

    return (
      <Alert
        type="info"
        showIcon
        data-test-id="replay-error"
        trailingItems={
          <LinkButton
            external
            href="https://docs.sentry.io/platforms/javascript/session-replay/#error-linking"
            size="xs"
          >
            {t('Read Docs')}
          </LinkButton>
        }
      >
        <p>
          {t(
            'The replay for this event cannot be found. This could be due to these reasons:'
          )}
        </p>
        <List symbol="bullet">
          {reasons.map((reason, i) => (
            <ListItem key={i}>{reason}</ListItem>
          ))}
        </List>
      </Alert>
    );
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
    >
      <PlayerContainer data-test-id="player-container" ref={fullscreenRef}>
        {replay?.hasProcessingErrors() ? (
          <ReplayProcessingError processingErrors={replay.processingErrors()} />
        ) : (
          <ReplayPreviewPlayer toggleFullscreen={toggleFullscreen} replayId={replayId} />
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

const TimeAndScrubberGrid = styled('div')`
  width: 100%;
  display: grid;
  grid-template-areas:
    '. timeline .'
    'currentTime scrubber duration';
  grid-column-gap: ${space(1)};
  grid-template-columns: max-content auto max-content;
  align-items: center;
`;

const Time = styled('span')`
  font-variant-numeric: tabular-nums;
  padding: 0 ${space(1.5)};
`;

const StyledScrubber = styled('div')`
  height: 32px;
  display: flex;
  align-items: center;
`;

export default ReplayClipPreview;
