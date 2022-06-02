import React, {useEffect, useRef, useState} from 'react';
import styled from '@emotion/styled';
import debounce from 'lodash/debounce';

import {Panel, PanelBody, PanelHeader as _PanelHeader} from 'sentry/components/panels';
import HorizontalMouseTracking from 'sentry/components/replays/player/horizontalMouseTracking';
import {PlayerScrubber} from 'sentry/components/replays/player/scrubber';
import ReplayController from 'sentry/components/replays/replayController';
import ReplayCurrentUrl from 'sentry/components/replays/replayCurrentUrl';
import ReplayPlayer from 'sentry/components/replays/replayPlayer';
import theme from 'sentry/utils/theme';
import useMedia from 'sentry/utils/useMedia';

// How much to reveal under the player, so people can see the 'pagefold' and
// know that they can scroll the page.
const BOTTOM_REVEAL_PIXELS = 70;

type Props = {
  isFullscreen: boolean;
  toggleFullscreen: () => void;
};

function ReplayView({isFullscreen, toggleFullscreen}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<HTMLDivElement>(null);
  const isScreenLarge = useMedia(`(min-width: ${theme.breakpoints[0]})`);

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
    if (!isScreenLarge) {
      setPlayerHeight(200);
    } else {
      setPlayerHeight(Math.max(200, calc));
    }
  }, [isScreenLarge, windowInnerHeight]);

  return (
    <PanelNoMargin ref={containerRef} isFullscreen={isFullscreen}>
      <PanelHeader>
        <ReplayCurrentUrl />
      </PanelHeader>
      <PanelHeader ref={playerRef} disablePadding noBorder>
        <ReplayPlayer height={isFullscreen ? Infinity : playerHeight} />
      </PanelHeader>
      <HorizontalMouseTracking>
        <PlayerScrubber />
      </HorizontalMouseTracking>
      <PanelBody withPadding>
        <ReplayController toggleFullscreen={toggleFullscreen} />
      </PanelBody>
    </PanelNoMargin>
  );
}

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
