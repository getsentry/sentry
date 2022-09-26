import styled from '@emotion/styled';

import Button from 'sentry/components/button';
import FeatureBadge from 'sentry/components/featureBadge';
import Placeholder from 'sentry/components/placeholder';
import {Provider as ReplayContextProvider} from 'sentry/components/replays/replayContext';
import ReplayView from 'sentry/components/replays/replayView';
import {IconPlay} from 'sentry/icons';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import useFullscreen from 'sentry/utils/replays/hooks/useFullscreen';
import useReplayData from 'sentry/utils/replays/hooks/useReplayData';
import FluidHeight from 'sentry/views/replays/detail/layout/fluidHeight';

type Props = {
  orgSlug: string;
  replaySlug: string;
};

function ReplayContent({orgSlug, replaySlug}: Props) {
  const {fetching, replay, fetchError} = useReplayData({
    orgSlug,
    replaySlug,
  });
  const {ref: fullscreenRef, toggle: toggleFullscreen} = useFullscreen();

  if (fetchError) {
    throw new Error('Failed to load Replay');
  }

  const replayRecord = replay?.getReplay();

  if (fetching || !replayRecord) {
    return (
      <StyledPlaceholder
        testId="replay-loading-placeholder"
        height="400px"
        width="100%"
      />
    );
  }

  return (
    <ReplayContextProvider replay={replay} initialTimeOffset={0}>
      <PlayerContainer ref={fullscreenRef} data-test-id="player-container">
        <BadgeContainer>
          <FeatureText>Replays</FeatureText>
          <FeatureBadge type="alpha" />
        </BadgeContainer>
        <ReplayView
          toggleFullscreen={toggleFullscreen}
          showAddressBar={false}
          controlBarActions={
            <Button
              to={`/organizations/${orgSlug}/replays/${replaySlug}`}
              priority="primary"
              size="sm"
              icon={<IconPlay size="sm" />}
            >
              {t('View Full Replay')}
            </Button>
          }
        />
      </PlayerContainer>
    </ReplayContextProvider>
  );
}

const PlayerContainer = styled(FluidHeight)`
  position: relative;
  margin-bottom: ${space(2)};
  background: ${p => p.theme.background};
  gap: ${space(1)};
`;

const StyledPlaceholder = styled(Placeholder)`
  margin-bottom: ${space(2)};
`;

const BadgeContainer = styled('div')`
  display: flex;
  align-items: center;
  position: absolute;
  top: ${space(1)};
  right: ${space(1)};
  background: ${p => p.theme.background};
  border-radius: 2.5rem;
  padding: ${space(0.75)} ${space(0.75)};
  z-index: 2;
  box-shadow: ${p => p.theme.dropShadowLightest};
`;

const FeatureText = styled('div')`
  font-size: ${p => p.theme.fontSizeSmall};
  color: ${p => p.theme.text};
  margin-left: ${space(0.75)};
  margin-right: ${space(0.25)};
`;

export default ReplayContent;
