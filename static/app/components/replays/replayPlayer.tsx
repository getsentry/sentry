import {Fragment, useCallback, useEffect, useRef, useState} from 'react';
import styled from '@emotion/styled';
import {useResizeObserver} from '@react-aria/utils';

import NegativeSpaceContainer from 'sentry/components/container/negativeSpaceContainer';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import BufferingOverlay from 'sentry/components/replays/player/bufferingOverlay';
import FastForwardBadge from 'sentry/components/replays/player/fastForwardBadge';
import {
  baseReplayerCss,
  sentryReplayerCss,
} from 'sentry/components/replays/player/styles';
import {useReplayContext} from 'sentry/components/replays/replayContext';
import {trackAnalytics} from 'sentry/utils/analytics';
import useOrganization from 'sentry/utils/useOrganization';

import PlayerDOMAlert from './playerDOMAlert';

type Dimensions = ReturnType<typeof useReplayContext>['dimensions'];

interface Props {
  className?: string;
  isPreview?: boolean;
  overlayContent?: React.ReactNode;
}

function useVideoSizeLogger({
  videoDimensions,
  windowDimensions,
}: {
  videoDimensions: Dimensions;
  windowDimensions: Dimensions;
}) {
  const organization = useOrganization();
  const [didLog, setDidLog] = useState<boolean>(false);
  const {analyticsContext} = useReplayContext();

  useEffect(() => {
    if (didLog || (videoDimensions.width === 0 && videoDimensions.height === 0)) {
      return;
    }

    const aspect_ratio =
      videoDimensions.width > videoDimensions.height ? 'landscape' : 'portrait';

    const scale = Math.min(
      windowDimensions.width / videoDimensions.width,
      windowDimensions.height / videoDimensions.height,
      1
    );
    const scale_bucket = (Math.floor(scale * 10) * 10) as Parameters<
      typeof trackAnalytics<'replay.render-player'>
    >[1]['scale_bucket'];

    trackAnalytics('replay.render-player', {
      organization,
      aspect_ratio,
      context: analyticsContext,
      scale_bucket,
    });
    setDidLog(true);
  }, [organization, windowDimensions, videoDimensions, didLog, analyticsContext]);
}

function BasePlayerRoot({className, overlayContent, isPreview = false}: Props) {
  const {
    dimensions: videoDimensions,
    fastForwardSpeed,
    setRoot,
    isBuffering,
    isVideoBuffering,
    isFetching,
    isFinished,
    isVideoReplay,
  } = useReplayContext();

  const windowEl = useRef<HTMLDivElement>(null);
  const viewEl = useRef<HTMLDivElement>(null);

  const [windowDimensions, setWindowDimensions] = useState<Dimensions>({
    width: 0,
    height: 0,
  });

  useVideoSizeLogger({videoDimensions, windowDimensions});

  // Sets the parent element where the player
  // instance will use as root (i.e. where it will
  // create an iframe)
  useEffect(() => {
    // XXX: This is smelly, but without the
    // dependence on `isFetching` here, will result
    // in ReplayContext creating a new Replayer
    // instance before events are hydrated. This
    // resulted in the `recording(Start/End)Frame`
    // as the only two events when we instantiated
    // Replayer and the rrweb Replayer requires all
    // events to be present when instantiated.
    if (!isFetching) {
      setRoot(viewEl.current);
    }
    return () => {
      setRoot(null);
    };
  }, [setRoot, isFetching]);

  // Read the initial width & height where the player will be inserted, this is
  // so we can shrink the video into the available space.
  // If the size of the container changes, we can re-calculate the scaling factor
  const updateWindowDimensions = useCallback(
    () =>
      setWindowDimensions({
        width: windowEl.current?.clientWidth || 0,
        height: windowEl.current?.clientHeight || 0,
      }),
    [setWindowDimensions]
  );
  useResizeObserver({ref: windowEl, onResize: updateWindowDimensions});
  // If your browser doesn't have ResizeObserver then set the size once.
  useEffect(() => {
    if (typeof window.ResizeObserver !== 'undefined') {
      return;
    }
    updateWindowDimensions();
  }, [updateWindowDimensions]);

  // Update the scale of the view whenever dimensions have changed.
  useEffect(() => {
    if (viewEl.current) {
      // We use 1.5 here because we want to scale up mobile replays
      // (or other replays that have height > width)
      const scale = Math.min(
        windowDimensions.width / videoDimensions.width,
        windowDimensions.height / videoDimensions.height,
        1.5
      );
      if (scale) {
        viewEl.current.style['transform-origin'] = 'top left';
        viewEl.current.style.transform = `scale(${scale})`;
        viewEl.current.style.width = `${videoDimensions.width * scale}px`;
        viewEl.current.style.height = `${videoDimensions.height * scale}px`;
      }
    }
  }, [windowDimensions, videoDimensions]);

  return (
    <Fragment>
      {isFinished && overlayContent && (
        <Overlay>
          <OverlayInnerWrapper>{overlayContent}</OverlayInnerWrapper>
        </Overlay>
      )}
      <StyledNegativeSpaceContainer ref={windowEl} className="sentry-block">
        <div ref={viewEl} className={className} />
        {fastForwardSpeed ? <PositionedFastForward speed={fastForwardSpeed} /> : null}
        {isBuffering || isVideoBuffering ? <PositionedBuffering /> : null}
        {isPreview || isVideoReplay || isFetching ? null : <PlayerDOMAlert />}
        {isFetching ? <PositionedLoadingIndicator /> : null}
      </StyledNegativeSpaceContainer>
    </Fragment>
  );
}

const PositionedFastForward = styled(FastForwardBadge)`
  position: absolute;
  left: 0;
  bottom: 0;
`;

const PositionedBuffering = styled(BufferingOverlay)`
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
`;

const PositionedLoadingIndicator = styled(LoadingIndicator)`
  position: absolute;
`;

// Base styles, to make the Replayer instance work
const PlayerRoot = styled(BasePlayerRoot)`
  ${baseReplayerCss}
`;

// Sentry-specific styles for the player.
const SentryPlayerRoot = styled(PlayerRoot)`
  ${p => sentryReplayerCss(p.theme)}
`;

const Overlay = styled('div')`
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  z-index: 1;
`;

const OverlayInnerWrapper = styled('div')`
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  color: white;
  display: flex;
  justify-content: center;
  flex-direction: column;
  align-items: center;
  gap: 9px;
`;

const StyledNegativeSpaceContainer = styled(NegativeSpaceContainer)`
  position: relative;
  width: 100%;
  height: 100%;
`;

export default SentryPlayerRoot;
