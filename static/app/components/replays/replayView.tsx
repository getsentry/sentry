import {useEffect, useRef, useState} from 'react';
import styled from '@emotion/styled';
import debounce from 'lodash/debounce';

import {Panel, PanelBody, PanelHeader as _PanelHeader} from 'sentry/components/panels';
import {PlayerScrubber} from 'sentry/components/replays/player/scrubber';
import ScrubberMouseTracking from 'sentry/components/replays/player/scrubberMouseTracking';
import ReplayController from 'sentry/components/replays/replayController';
import ReplayCurrentUrl from 'sentry/components/replays/replayCurrentUrl';
import ReplayPlayer from 'sentry/components/replays/replayPlayer';
import space from 'sentry/styles/space';

// How much to reveal under the player, so people can see the 'pagefold' and
// know that they can scroll the page.
const BOTTOM_REVEAL_PIXELS = 70;

const SCREEN_HEIGHT_DIVISOR = 2;

type Props = {
  isFullscreen: boolean;
  toggleFullscreen: () => void;
};

function ReplayView({isFullscreen, toggleFullscreen}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<HTMLDivElement>(null);

  const [windowInnerHeight, setWindowInnerHeight] = useState(window.innerHeight);
  const [playerHeight, setPlayerHeight] = useState(0);

  useEffect(() => {
    const onResize = debounce(() => {
      setWindowInnerHeight(window.innerHeight);
    });
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
    };
  }, []);

  useEffect(() => {
    const containerBottom =
      (containerRef.current?.offsetTop || 0) + (containerRef.current?.offsetHeight || 0);
    const playerOffsetHeight = playerRef.current?.offsetHeight || 0;
    const calc =
      windowInnerHeight - (containerBottom - playerOffsetHeight) - BOTTOM_REVEAL_PIXELS;
    setPlayerHeight(Math.max(200, calc / SCREEN_HEIGHT_DIVISOR));
  }, [windowInnerHeight]);

  return (
    <PanelNoMargin ref={containerRef} isFullscreen={isFullscreen}>
      <PanelHeader>
        <ReplayCurrentUrl />
      </PanelHeader>
      <PanelHeader ref={playerRef} disablePadding noBorder>
        <ReplayPlayer height={isFullscreen ? Infinity : playerHeight} />
      </PanelHeader>
      <ScrubberMouseTracking>
        <PlayerScrubber />
      </ScrubberMouseTracking>
      <ReplayControllerWrapper>
        <ReplayController toggleFullscreen={toggleFullscreen} />
      </ReplayControllerWrapper>
    </PanelNoMargin>
  );
}

const ReplayControllerWrapper = styled(PanelBody)`
  padding: ${space(1)};
`;

const PanelNoMargin = styled(Panel)<{isFullscreen: boolean}>`
  margin-bottom: 0;

  ${p =>
    p.isFullscreen
      ? `height: 100%;
      display: grid;
      grid-template-rows: auto 1fr auto;
      `
      : ''}
`;

const PanelHeader = styled(_PanelHeader)<{noBorder?: boolean}>`
  display: block;
  padding: 0;
  ${p => (p.noBorder ? 'border-bottom: none;' : '')}
`;

export default ReplayView;
