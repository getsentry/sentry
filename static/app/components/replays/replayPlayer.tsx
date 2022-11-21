import React, {useCallback, useEffect, useRef, useState} from 'react';
import styled from '@emotion/styled';
import {useResizeObserver} from '@react-aria/utils';

import {Panel as _Panel} from 'sentry/components/panels';
import BufferingOverlay from 'sentry/components/replays/player/bufferingOverlay';
import FastForwardBadge from 'sentry/components/replays/player/fastForwardBadge';
import {useReplayContext} from 'sentry/components/replays/replayContext';
import trackAdvancedAnalyticsEvent from 'sentry/utils/analytics/trackAdvancedAnalyticsEvent';
import useOrganization from 'sentry/utils/useOrganization';

import PlayerDOMAlert from './playerDOMAlert';

type Dimensions = ReturnType<typeof useReplayContext>['dimensions'];

interface Props {
  className?: string;
  isPreview?: boolean;
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
      typeof trackAdvancedAnalyticsEvent<'replay.render-player'>
    >[1]['scale_bucket'];

    trackAdvancedAnalyticsEvent('replay.render-player', {
      organization,
      aspect_ratio,
      scale_bucket,
    });
    setDidLog(true);
  }, [organization, windowDimensions, videoDimensions, didLog]);
}

function BasePlayerRoot({className, isPreview = false}: Props) {
  const {
    initRoot,
    dimensions: videoDimensions,
    fastForwardSpeed,
    isBuffering,
  } = useReplayContext();

  const windowEl = useRef<HTMLDivElement>(null);
  const viewEl = useRef<HTMLDivElement>(null);

  const [windowDimensions, setWindowDimensions] = useState<Dimensions>({
    width: 0,
    height: 0,
  });

  useVideoSizeLogger({videoDimensions, windowDimensions});

  // Create the `rrweb` instance which creates an iframe inside `viewEl`
  useEffect(() => initRoot(viewEl.current), [initRoot]);

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
      const scale = Math.min(
        windowDimensions.width / videoDimensions.width,
        windowDimensions.height / videoDimensions.height,
        1
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
    <SizingWindow ref={windowEl} className="sentry-block">
      <div ref={viewEl} className={className} />
      {fastForwardSpeed ? <PositionedFastForward speed={fastForwardSpeed} /> : null}
      {isBuffering ? <PositionedBuffering /> : null}
      {!isPreview ? <PlayerDOMAlert /> : null}
    </SizingWindow>
  );
}

// Center the viewEl inside the windowEl.
// This is useful when the window is inside a container that has large fixed
// dimensions, like when in fullscreen mode.
// If the container has a dimensions that can grow/shrink then it is
// important to also set `overflow: hidden` on the container, so that the
// SizingWindow can calculate size as things shrink.
const SizingWindow = styled('div')`
  width: 100%;
  display: flex;
  flex-grow: 1;
  justify-content: center;
  align-items: center;
  position: relative;
  overflow: hidden;

  background-color: ${p => p.theme.backgroundSecondary};
  background-image: repeating-linear-gradient(
      -145deg,
      transparent,
      transparent 8px,
      ${p => p.theme.backgroundSecondary} 8px,
      ${p => p.theme.backgroundSecondary} 11px
    ),
    repeating-linear-gradient(
      -45deg,
      transparent,
      transparent 15px,
      ${p => p.theme.gray100} 15px,
      ${p => p.theme.gray100} 16px
    );
`;

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

// Base styles, to make the Replayer instance work
const PlayerRoot = styled(BasePlayerRoot)`
  .replayer-wrapper {
    user-select: none;
  }
  .replayer-wrapper > .replayer-mouse-tail {
    position: absolute;
    pointer-events: none;
  }

  /* Override default user-agent styles */
  .replayer-wrapper > iframe {
    border: none;
    background: white;
  }
`;

// Sentry-specific styles for the player.
// The elements we have to work with are:
// ```css
// div.replayer-wrapper {}
// div.replayer-wrapper > div.replayer-mouse {}
// div.replayer-wrapper > canvas.replayer-mouse-tail {}
// div.replayer-wrapper > iframe {}
// ```
// The mouse-tail is also configured for color/size in `app/components/replays/replayContext.tsx`
const SentryPlayerRoot = styled(PlayerRoot)`
  .replayer-mouse {
    position: absolute;
    width: 32px;
    height: 32px;
    transition: left 0.05s linear, top 0.05s linear;
    background-size: contain;
    background-repeat: no-repeat;
    background-image: url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTIiIGhlaWdodD0iMTkiIHZpZXdCb3g9IjAgMCAxMiAxOSIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTAgMTZWMEwxMS42IDExLjZINC44TDQuNCAxMS43TDAgMTZaIiBmaWxsPSJ3aGl0ZSIvPgo8cGF0aCBkPSJNOS4xIDE2LjdMNS41IDE4LjJMMC43OTk5OTkgNy4xTDQuNSA1LjZMOS4xIDE2LjdaIiBmaWxsPSJ3aGl0ZSIvPgo8cGF0aCBkPSJNNC42NzQ1MSA4LjYxODUxTDIuODMwMzEgOS4zOTI3MUw1LjkyNzExIDE2Ljc2OTVMNy43NzEzMSAxNS45OTUzTDQuNjc0NTEgOC42MTg1MVoiIGZpbGw9ImJsYWNrIi8+CjxwYXRoIGQ9Ik0xIDIuNFYxMy42TDQgMTAuN0w0LjQgMTAuNkg5LjJMMSAyLjRaIiBmaWxsPSJibGFjayIvPgo8L3N2Zz4K');
    border-color: transparent;
  }
  .replayer-mouse:after {
    content: '';
    display: inline-block;
    width: 32px;
    height: 32px;
    background: ${p => p.theme.purple300};
    border-radius: 100%;
    transform: translate(-50%, -50%);
    opacity: 0.3;
  }
  .replayer-mouse.active:after {
    animation: click 0.2s ease-in-out 1;
  }
  .replayer-mouse.touch-device {
    background-image: none;
    width: 70px;
    height: 70px;
    border-radius: 100%;
    margin-left: -37px;
    margin-top: -37px;
    border: 4px solid rgba(73, 80, 246, 0);
    transition: left 0s linear, top 0s linear, border-color 0.2s ease-in-out;
  }
  .replayer-mouse.touch-device.touch-active {
    border-color: ${p => p.theme.purple200};
    transition: left 0.25s linear, top 0.25s linear, border-color 0.2s ease-in-out;
  }
  .replayer-mouse.touch-device:after {
    opacity: 0;
  }
  .replayer-mouse.touch-device.active:after {
    animation: touch-click 0.2s ease-in-out 1;
  }
  @keyframes click {
    0% {
      opacity: 0.3;
      width: 20px;
      height: 20px;
    }
    50% {
      opacity: 0.5;
      width: 10px;
      height: 10px;
    }
  }
  @keyframes touch-click {
    0% {
      opacity: 0;
      width: 20px;
      height: 20px;
    }
    50% {
      opacity: 0.5;
      width: 10px;
      height: 10px;
    }
  }
`;

export default SentryPlayerRoot;
