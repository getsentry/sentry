import React, {useEffect, useRef} from 'react';
import styled from '@emotion/styled';

import {Panel, PanelBody, PanelHeader as _PanelHeader} from 'sentry/components/panels';
import HorizontalMouseTracking from 'sentry/components/replays/player/horizontalMouseTracking';
import {PlayerScrubber} from 'sentry/components/replays/player/scrubber';
import ReplayController from 'sentry/components/replays/replayController';
import ReplayCurrentUrl from 'sentry/components/replays/replayCurrentUrl';
import ReplayPlayer from 'sentry/components/replays/replayPlayer';

type Props = {
  isFloating: boolean;
  isFullscreen: boolean;
  toggleFullscreen: () => void;
};

function ReplayView({isFloating, isFullscreen, toggleFullscreen}: Props) {
  const resizeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isFloating) {
      resizeRef.current?.style.setProperty('height', '200px');
      resizeRef.current?.style.setProperty('width', '200px');
    } else {
      resizeRef.current?.style.removeProperty('height');
      resizeRef.current?.style.removeProperty('width');
    }
  }, [isFloating]);

  return (
    <PanelNoMargin isFloating={isFloating} isFullscreen={isFullscreen}>
      <PanelHeader>
        <ReplayCurrentUrl />
      </PanelHeader>
      <PanelHeader disablePadding noBorder>
        <ManualResize ref={resizeRef} isFloating={isFloating} isFullscreen={isFullscreen}>
          <ReplayPlayer />
        </ManualResize>
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

const PanelNoMargin = styled(Panel)<{isFloating: boolean; isFullscreen: boolean}>`
  margin-bottom: 0;

  ${p =>
    p.isFullscreen
      ? `height: 100%;
      display: grid;
      grid-template-rows: auto 1fr auto;
      `
      : ''}

  ${p =>
    p.isFloating
      ? `
      /* position is relative to the window */
      position: fixed;
      left: 300px;
      top: 200px;
      box-shadow: 0px 8px 17px -6px rgb(0 0 0 / 97%);

      /* TODO(replay): get our own z-index mapping, above trace */
      z-index: ${p.theme.zIndex.header};
      `
      : ''}
`;

const PanelHeader = styled(_PanelHeader)<{noBorder?: boolean}>`
  display: block;
  padding: 0;
  ${p => (p.noBorder ? 'border-bottom: none;' : '')}
`;

const ManualResize = styled('div')<{isFloating: boolean; isFullscreen: boolean}>`
  resize: ${p => (p.isFloating ? 'both' : 'vertical')};
  overflow: auto;
  max-width: 100%;
  max-height: 40em;
  height: auto;

  ${p =>
    p.isFullscreen
      ? `resize: none;
      /* use !important to override html attrs set by resize:vertical */
      max-height: 100%;
      width: auto !important;
      height: 100% !important;
      `
      : ''}
`;

export default ReplayView;
