import React from 'react';
import styled from '@emotion/styled';

import {Panel, PanelBody, PanelHeader as _PanelHeader} from 'sentry/components/panels';
import HorizontalMouseTracking from 'sentry/components/replays/player/horizontalMouseTracking';
import {PlayerScrubber} from 'sentry/components/replays/player/scrubber';
import ReplayController from 'sentry/components/replays/replayController';
import ReplayCurrentUrl from 'sentry/components/replays/replayCurrentUrl';
import ReplayPlayer from 'sentry/components/replays/replayPlayer';

type Props = {
  isFullscreen: boolean;
  toggleFullscreen: () => void;
};

function ReplayView({isFullscreen, toggleFullscreen}: Props) {
  return (
    <PanelNoMargin isFullscreen={isFullscreen}>
      <PanelHeader>
        <ReplayCurrentUrl />
      </PanelHeader>
      <PanelHeader disablePadding noBorder>
        <ManualResize isFullscreen={isFullscreen}>
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

const ManualResize = styled('div')<{isFullscreen: boolean}>`
  resize: vertical;
  overflow: auto;
  max-width: 100%;

  ${p =>
    p.isFullscreen
      ? `resize: none;
      /* use !important to override html attrs set by resize:vertical */
      width: auto !important;
      height: 100% !important;
      `
      : ''}
`;

export default ReplayView;
