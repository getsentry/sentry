import type {ComponentProps} from 'react';
import {Fragment, useCallback, useMemo, useRef, useState} from 'react';
import styled from '@emotion/styled';
import screenfull from 'screenfull';

import {Alert} from 'sentry/components/alert';
import {LinkButton} from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import ErrorBoundary from 'sentry/components/errorBoundary';
import ProjectBadge from 'sentry/components/idBadge/projectBadge';
import Link from 'sentry/components/links/link';
import Panel from 'sentry/components/panels/panel';
import Placeholder from 'sentry/components/placeholder';
import {Flex} from 'sentry/components/profiling/flex';
import MissingReplayAlert from 'sentry/components/replays/alerts/missingReplayAlert';
import {BreadcrumbCustomizationProvider} from 'sentry/components/replays/breadcrumbs/breadcrumbCustomizationContext';
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
import {getShortEventId} from 'sentry/utils/events';
import getRouteStringFromRoutes from 'sentry/utils/getRouteStringFromRoutes';
import {TabKey} from 'sentry/utils/replays/hooks/useActiveReplayTab';
import useReplayReader from 'sentry/utils/replays/hooks/useReplayReader';
import type {ErrorFrame, ReplayFrame} from 'sentry/utils/replays/types';
import {isErrorFrame} from 'sentry/utils/replays/types';
import type RequestError from 'sentry/utils/requestError/requestError';
import useRouteAnalyticsParams from 'sentry/utils/routeAnalytics/useRouteAnalyticsParams';
import useOrganization from 'sentry/utils/useOrganization';
import useProjectFromSlug from 'sentry/utils/useProjectFromSlug';
import {useRoutes} from 'sentry/utils/useRoutes';
import useFullscreen from 'sentry/utils/window/useFullscreen';
import useIsFullscreen from 'sentry/utils/window/useIsFullscreen';
import {normalizeUrl} from 'sentry/utils/withDomainRequired';
import Breadcrumbs from 'sentry/views/replays/detail/breadcrumbs';
import BrowserOSIcons from 'sentry/views/replays/detail/browserOSIcons';
import FluidHeight from 'sentry/views/replays/detail/layout/fluidHeight';
import type {ReplayRecord} from 'sentry/views/replays/types';

type Props = {
  eventTimestampMs: number;
  orgSlug: string;
  replaySlug: string;
  eventId?: string;
  focusTab?: TabKey;
  fullReplayButtonProps?: Partial<ComponentProps<typeof LinkButton>>;
  groupId?: string;
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

function CustomBreadcrumbTitle({frame, eventId}: {frame: ErrorFrame; eventId?: string}) {
  const organization = useOrganization();

  if (frame.data.eventId === eventId) {
    return <Fragment>Error: This Event</Fragment>;
  }

  return (
    <Fragment>
      Error:{' '}
      <Link
        to={`/organizations/${organization.slug}/issues/${frame.data.groupId}/events/${frame.data.eventId}/#replay`}
      >
        {getShortEventId(frame.data.eventId)}
      </Link>
    </Fragment>
  );
}

function CustomBreadcrumbIssueInfo({
  frame,
  groupId,
}: {
  frame: ErrorFrame;
  groupId?: string;
}) {
  const organization = useOrganization();

  const project = useProjectFromSlug({
    organization,
    projectSlug: frame.data.projectSlug,
  });

  const projectBadge = project ? (
    <ProjectBadge project={project} avatarSize={16} disableLink displayName={false} />
  ) : null;

  if (`${frame.data.groupId}` === groupId) {
    return (
      <BreadcrumbIssueShortCode>
        {projectBadge}
        {frame.data.groupShortId}
      </BreadcrumbIssueShortCode>
    );
  }

  return (
    <BreadcrumbIssueShortCode>
      {projectBadge}
      <Link
        to={`/organizations/${organization.slug}/issues/${frame.data.groupId}/events/${frame.data.eventId}/#replay`}
      >
        {frame.data.groupShortId}
      </Link>
    </BreadcrumbIssueShortCode>
  );
}

function ReplayPreviewPlayer({
  toggleFullscreen,
  replayId,
  fullReplayButtonProps,
  groupId,
  eventId,
}: {
  replayId: string;
  toggleFullscreen: () => void;
  eventId?: string;
  fullReplayButtonProps?: Partial<ComponentProps<typeof LinkButton>>;
  groupId?: string;
}) {
  const routes = useRoutes();
  const organization = useOrganization();
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
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

  const renderBreadcrumbTitle = useCallback(
    ({frame}: {frame: ReplayFrame}) => {
      if (!isErrorFrame(frame)) {
        return null;
      }
      return <CustomBreadcrumbTitle frame={frame} eventId={eventId} />;
    },
    [eventId]
  );

  const renderBreadcrumbProject = useCallback(
    ({frame}: {frame: ReplayFrame}) => {
      if (!isErrorFrame(frame)) {
        return null;
      }
      return <CustomBreadcrumbIssueInfo frame={frame} groupId={groupId} />;
    },
    [groupId]
  );

  return (
    <BreadcrumbCustomizationProvider
      renderTitle={renderBreadcrumbTitle}
      renderProjectInfo={renderBreadcrumbProject}
    >
      <PlayerPanel>
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
              {showFullscreenButton ? (
                <ReplayFullscreenButton toggleFullscreen={toggleFullscreen} />
              ) : null}
            </ButtonBar>
          </ButtonGrid>
        </ErrorBoundary>
      </PlayerPanel>
    </BreadcrumbCustomizationProvider>
  );
}

function ReplayClipPreview({
  eventTimestampMs,
  orgSlug,
  replaySlug,
  fullReplayButtonProps,
  eventId,
  groupId,
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
            eventId={eventId}
            groupId={groupId}
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

const PlayerContainer = styled(FluidHeight)`
  position: relative;
  background: ${p => p.theme.background};
  gap: ${space(1)};
  max-height: 448px;

  :fullscreen {
    padding: ${space(1)};

    ${PlayerBreadcrumbContainer} {
      display: grid;
      grid-template-columns: 1fr auto;
      height: 100%;
      gap: ${space(1)};
    }
  }
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

const BreadcrumbIssueShortCode = styled('div')`
  display: flex;
  align-items: center;
  font-size: ${p => p.theme.fontSizeSmall};
  color: ${p => p.theme.subText};
  margin-top: ${space(0.25)};
`;

export default ReplayClipPreview;
