import {useMemo} from 'react';
import styled from '@emotion/styled';

import Button from 'sentry/components/button';
import Placeholder from 'sentry/components/placeholder';
import {Provider as ReplayContextProvider} from 'sentry/components/replays/replayContext';
import ReplaysFeatureBadge from 'sentry/components/replays/replaysFeatureBadge';
import ReplayView from 'sentry/components/replays/replayView';
import {relativeTimeInMs} from 'sentry/components/replays/utils';
import {IconPlay} from 'sentry/icons';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {Event} from 'sentry/types/event';
import useFullscreen from 'sentry/utils/replays/hooks/useFullscreen';
import useReplayData from 'sentry/utils/replays/hooks/useReplayData';
import FluidHeight from 'sentry/views/replays/detail/layout/fluidHeight';

type Props = {
  event: Event;
  orgSlug: string;
  replaySlug: string;
};

function ReplayContent({orgSlug, replaySlug, event}: Props) {
  const {fetching, replay, fetchError} = useReplayData({
    orgSlug,
    replaySlug,
  });
  const {ref: fullscreenRef, toggle: toggleFullscreen} = useFullscreen();
  const eventTimestamp = event.dateCreated
    ? Math.floor(new Date(event.dateCreated).getTime() / 1000) * 1000
    : 0;

  if (fetchError) {
    throw new Error('Failed to load Replay');
  }

  const replayRecord = replay?.getReplay();

  const startTimestampMs = replayRecord?.startedAt.getTime() ?? 0;

  const initialTimeOffset = useMemo(() => {
    if (eventTimestamp && startTimestampMs) {
      return relativeTimeInMs(eventTimestamp, startTimestampMs) / 1000;
    }

    return 0;
  }, [eventTimestamp, startTimestampMs]);

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
    <ReplayContextProvider replay={replay} initialTimeOffset={initialTimeOffset}>
      <PlayerContainer ref={fullscreenRef} data-test-id="player-container">
        <BadgeContainer>
          <FeatureText>{t('Replays')}</FeatureText>
          <ReplaysFeatureBadge />
        </BadgeContainer>
        <ReplayView
          toggleFullscreen={toggleFullscreen}
          showAddressBar={false}
          controlBarActions={
            <Button
              data-test-id="view-replay-button"
              to={{
                pathname: `/organizations/${orgSlug}/replays/${replaySlug}/`,
                query: {
                  t_main: 'console',
                  f_c_search: undefined,
                  ...(initialTimeOffset ? {t: initialTimeOffset} : {}),
                },
              }}
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
  border-radius: 2.25rem;
  padding: ${space(0.75)} ${space(0.75)} ${space(0.75)} ${space(1)};
  z-index: 2;
  box-shadow: ${p => p.theme.dropShadowLightest};
  gap: 0 ${space(0.25)};
`;

const FeatureText = styled('div')`
  font-size: ${p => p.theme.fontSizeSmall};
  line-height: 0;
  color: ${p => p.theme.text};
`;

export default ReplayContent;
