import {Fragment} from 'react';
import styled from '@emotion/styled';

import ReplayController from 'sentry/components/replays/replayController';
import ReplayCurrentUrl from 'sentry/components/replays/replayCurrentUrl';
import ReplayPlayer from 'sentry/components/replays/replayPlayer';
import {space} from 'sentry/styles/space';
import useOrganization from 'sentry/utils/useOrganization';
import BrowserOSIcons from 'sentry/views/replays/detail/browserOSIcons';
import FluidHeight from 'sentry/views/replays/detail/layout/fluidHeight';

type Props = {
  toggleFullscreen: () => void;
};

function ReplayView({toggleFullscreen}: Props) {
  const organization = useOrganization();
  const hasNewTimeline = organization.features.includes('session-replay-new-timeline');
  return (
    <Fragment>
      <ContextContainer>
        <ReplayCurrentUrl />
        <BrowserOSIcons />
      </ContextContainer>
      <Panel>
        <ReplayPlayer />
      </Panel>
      {hasNewTimeline ? null : <ReplayController toggleFullscreen={toggleFullscreen} />}
    </Fragment>
  );
}

const Panel = styled(FluidHeight)`
  background: ${p => p.theme.background};
  border-radius: ${p => p.theme.borderRadius};
  border: 1px solid ${p => p.theme.border};
  box-shadow: ${p => p.theme.dropShadowMedium};
`;

const ContextContainer = styled('div')`
  display: grid;
  grid-auto-flow: column;
  grid-template-columns: 1fr max-content max-content;
  align-items: center;
  gap: ${space(1)};
`;

export default ReplayView;
