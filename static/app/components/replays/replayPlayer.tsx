import {useCallback, useEffect, useRef, useState} from 'react';
import styled from '@emotion/styled';
import {useResizeObserver} from '@react-aria/utils';

import {Panel as _Panel} from 'sentry/components/panels';
import {useReplayContext} from 'sentry/components/replays/replayContext';
import useFullscreen from 'sentry/components/replays/useFullscreen';
import Tooltip from 'sentry/components/tooltip';
import {IconArrow} from 'sentry/icons';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';

interface Props {
  className?: string;
}

function BasePlayerRoot({className}: Props) {
  const {isFullscreen} = useFullscreen();

  // In fullscreen we need to consider the max-height that the player is able
  // to full up, on a page that scrolls we only consider the max-width.
  const fixedHeight = isFullscreen;

  const {initRoot, dimensions: videoDimensions, fastForwardSpeed} = useReplayContext();

  const windowEl = useRef<HTMLDivElement>(null);
  const viewEl = useRef<HTMLDivElement>(null);

  const [windowDimensions, setWindowDimensions] = useState({
    width: 0,
    height: 0,
  });

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
    []
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
      const scale = fixedHeight
        ? Math.min(
            windowDimensions.width / videoDimensions.width,
            windowDimensions.height / videoDimensions.height,
            1
          )
        : Math.min(windowDimensions.width / videoDimensions.width, 1);
      if (scale) {
        viewEl.current.style['transform-origin'] = 'top left';
        viewEl.current.style.transform = `scale(${scale})`;
        viewEl.current.style.width = `${videoDimensions.width * scale}px`;
        viewEl.current.style.height = `${videoDimensions.height * scale}px`;
      }
    }
  }, [fixedHeight, windowDimensions, videoDimensions]);

  return (
    <Panel isFullscreen={isFullscreen}>
      <Centered ref={windowEl} className="sr-block" data-test-id="replay-window">
        <div ref={viewEl} data-test-id="replay-view" className={className} />
        {fastForwardSpeed ? (
          <FastForwardBadge>
            <FastForwardTooltip title={t('Fast forwarding')}>
              <IconArrow size="sm" direction="right" />
              {fastForwardSpeed}x
            </FastForwardTooltip>
          </FastForwardBadge>
        ) : null}
      </Centered>
    </Panel>
  );
}

const FastForwardBadge = styled('div')`
  position: absolute;
  bottom: 0;
  left: 0;
  background: ${p => p.theme.gray300};
  color: ${p => p.theme.white};
  padding: ${space(0.5)} ${space(1)};
  border-bottom-left-radius: ${p => p.theme.borderRadius};
  border-top-right-radius: ${p => p.theme.borderRadius};
`;

const FastForwardTooltip = styled(Tooltip)`
  display: grid;
  grid-template-columns: max-content max-content;
  gap: ${space(0.5)};
  align-items: center;
`;

const Panel = styled(_Panel)<{isFullscreen: boolean}>`
  /*
  Disable the <Panel> styles when in fullscreen mode.
  If we add/remove DOM nodes then the Replayer instance will have a stale iframe ref
  */
  ${p => (p.isFullscreen ? 'border: none; background: transparent;' : '')}

  iframe {
    /* Match the iframe corners to the <Panel> */
    border-radius: ${p => p.theme.borderRadius};
  }
`;

// Center the viewEl inside the windowEl.
// This is useful when the window is inside a container that has large fixed
// dimensions, like when in fullscreen mode.
const Centered = styled('div')`
  width: 100%;
  height: 100%;
  background: transparent;
  display: flex;
  align-items: center;
  justify-content: center;
`;

// Base styles, to make the Replayer instance work
const PlayerRoot = styled(BasePlayerRoot)`
  .replayer-wrapper > .replayer-mouse-tail {
    position: absolute;
    pointer-events: none;
  }

  /* Override default user-agent styles */
  .replayer-wrapper > iframe {
    border: none;
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
