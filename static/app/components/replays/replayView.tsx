import {Fragment} from 'react';
import styled from '@emotion/styled';

import {PlayerScrubber} from 'sentry/components/replays/player/scrubber';
import ScrubberMouseTracking from 'sentry/components/replays/player/scrubberMouseTracking';
import ReplayController from 'sentry/components/replays/replayController';
import ReplayCurrentUrl from 'sentry/components/replays/replayCurrentUrl';
import ReplayPlayer from 'sentry/components/replays/replayPlayer';
import space from 'sentry/styles/space';
import FluidHeight from 'sentry/views/replays/detail/layout/fluidHeight';

type Props = {
  toggleFullscreen: () => void;
};

function ReplayView({toggleFullscreen}: Props) {
  return (
    <Fragment>
      <ReplayCurrentUrl />
      <PlayerContainer>
        <Panel>
          <ReplayPlayer />
        </Panel>
        <ScrubberMouseTracking>
          <PlayerScrubber />
        </ScrubberMouseTracking>
      </PlayerContainer>
      <ReplayController toggleFullscreen={toggleFullscreen} />
    </Fragment>
  );
}

// Adjust the bottom spacing so that <PlayerScrubber> does not overflow outside
// of <FluidHeight>
const PlayerContainer = styled(FluidHeight)`
  padding-bottom: ${space(1)};
  margin-bottom: -${space(1)};
`;

const Panel = styled(FluidHeight)`
  background: ${p => p.theme.background};
  border-radius: ${p => p.theme.borderRadiusTop};
  border: 1px solid ${p => p.theme.border};
  border-bottom: none;
  box-shadow: ${p => p.theme.dropShadowLight};
`;

export default ReplayView;
