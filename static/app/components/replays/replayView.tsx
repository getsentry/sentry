import {Fragment} from 'react';
import styled from '@emotion/styled';

import ReplayController from 'sentry/components/replays/replayController';
import ReplayCurrentUrl from 'sentry/components/replays/replayCurrentUrl';
import ReplayPlayer from 'sentry/components/replays/replayPlayer';
import FluidHeight from 'sentry/views/replays/detail/layout/fluidHeight';

type Props = {
  toggleFullscreen: () => void;
};

function ReplayView({toggleFullscreen}: Props) {
  return (
    <Fragment>
      <ReplayCurrentUrl />
      <Panel>
        <ReplayPlayer />
      </Panel>
      <ReplayController toggleFullscreen={toggleFullscreen} />
    </Fragment>
  );
}

const Panel = styled(FluidHeight)`
  background: ${p => p.theme.background};
  border-radius: ${p => p.theme.borderRadius};
  border: 1px solid ${p => p.theme.border};
  box-shadow: ${p => p.theme.dropShadowMedium};
`;

export default ReplayView;
