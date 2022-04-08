import {useEffect, useRef, useState} from 'react';
import styled from '@emotion/styled';

import {Consumer as ReplayContextProvider} from 'sentry/components/replays/replayContext';

interface Props {
  className?: string;
}

type Dimensions = {height: number; width: number};
type RootElem = null | HTMLDivElement;

type RootProps = {
  initRoot: (root: RootElem) => void;
  videoDimensions: Dimensions;
  className?: string;
};

function BasePlayerRoot({className, initRoot, videoDimensions}: RootProps) {
  const windowEl = useRef<HTMLDivElement>(null);
  const viewEl = useRef<HTMLDivElement>(null);

  const [windowDimensions, setWindowDimensions] = useState<Dimensions>();

  // Create the `rrweb` instance which creates an iframe inside `viewEl`
  useEffect(() => initRoot(viewEl.current), [viewEl.current]);

  // Read the initial width/height where the player will be inserted, to setup view transform/scaling
  // Also listen for resize events and so we can update view transform/scaling
  useEffect(() => {
    // TODO: throttle or debounce this?
    const handleResize = () =>
      setWindowDimensions(windowEl.current?.getBoundingClientRect());
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [windowEl.current]);

  // Update the scale of the view whenever dimensions have changed.
  useEffect(() => {
    if (viewEl.current) {
      const scale = Math.min((windowDimensions?.width || 0) / videoDimensions.width, 1);
      if (scale) {
        viewEl.current.style.transform = `scale(${scale})`;
        viewEl.current.style.width = `${videoDimensions.width * scale}px`;
        viewEl.current.style.height = `${videoDimensions?.height * scale}px`;
      }
    }
  }, [windowDimensions, videoDimensions]);

  return (
    <div ref={windowEl} data-test-id="replay-window">
      <div ref={viewEl} data-test-id="replay-view" className={className} />
    </div>
  );
}

// Base styles, to make the player work
const PlayerRoot = styled(BasePlayerRoot)`
  /* Make sure the replayer fits inside it's container */
  transform-origin: top left;

  /* Fix the replayer layout so layers are stacked properly */
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

export default function ReplayPlayer({className}: Props) {
  return (
    <ReplayContextProvider>
      {({initRoot, dimensions}) => (
        <SentryPlayerRoot
          className={className}
          initRoot={initRoot}
          videoDimensions={dimensions}
        />
      )}
    </ReplayContextProvider>
  );
}
