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

function PlayerRoot({className, initRoot, videoDimensions}: RootProps) {
  const windowEl = useRef<HTMLDivElement>(null);
  const viewEl = useRef<HTMLDivElement>(null);

  const [windowDimensions, setWindowDimensions] = useState<Dimensions>();

  // Create the `rrweb` instance which creates an iframe inside `viewEl`
  useEffect(() => initRoot(viewEl.current), [viewEl.current]);

  // Read the initial width/height where the player will be inserted, to setup view transform/scaling
  // Also listen for resize events and so we can update view transform/scaling
  useEffect(() => {
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

const StyledPlayerRoot = styled(PlayerRoot)`
  /* Make sure the replayer fits inside it's container */
  transform-origin: top left;

  /* Fix the replayer layout so layers are stacked properly */
  .replayer-mouse-tail {
    position: absolute;
    pointer-events: none;
  }

  /* Skin the player to match our aesthetic */
  iframe {
    border: none;
  }
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
`;

export default function ReplayPlayer({className}: Props) {
  return (
    <ReplayContextProvider>
      {({initRoot, dimensions}) => (
        <StyledPlayerRoot
          className={className}
          initRoot={initRoot}
          videoDimensions={dimensions}
        />
      )}
    </ReplayContextProvider>
  );
}
