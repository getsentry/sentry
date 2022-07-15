import styled from '@emotion/styled';

import {Panel, PanelBody, PanelHeader as _PanelHeader} from 'sentry/components/panels';
import {PlayerScrubber} from 'sentry/components/replays/player/scrubber';
import ScrubberMouseTracking from 'sentry/components/replays/player/scrubberMouseTracking';
import ReplayController from 'sentry/components/replays/replayController';
import ReplayCurrentUrl from 'sentry/components/replays/replayCurrentUrl';
import ReplayPlayer from 'sentry/components/replays/replayPlayer';
import space from 'sentry/styles/space';

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
        <ReplayPlayer />
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
  height: 100%;
  display: grid;
  grid-template-rows: auto 1fr auto;
`;

const PanelHeader = styled(_PanelHeader)<{noBorder?: boolean}>`
  display: block;
  padding: 0;
  ${p => (p.noBorder ? 'border-bottom: none;' : '')}

  /*
  This style ensures that this PanelHeader grows and shrinks based on it's
  parent, not the content inside.

  The content inside will be set to height: 100% and then there's some code in
  there to measure the size in pixels. If this was normal overflow then measured
  size would never shrink.
  */
  overflow: hidden;
`;

export default ReplayView;
