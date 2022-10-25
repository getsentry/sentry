import {useMemo} from 'react';
import {Link} from 'react-router';
import styled from '@emotion/styled';

import Button from 'sentry/components/button';
import Placeholder from 'sentry/components/placeholder';
import {Provider as ReplayContextProvider} from 'sentry/components/replays/replayContext';
import ReplayPlayer from 'sentry/components/replays/replayPlayer';
import ReplaysFeatureBadge from 'sentry/components/replays/replaysFeatureBadge';
import {relativeTimeInMs} from 'sentry/components/replays/utils';
import {IconPlay} from 'sentry/icons';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {Event} from 'sentry/types/event';
import getRouteStringFromRoutes from 'sentry/utils/getRouteStringFromRoutes';
import useReplayData from 'sentry/utils/replays/hooks/useReplayData';
import {useRoutes} from 'sentry/utils/useRoutes';
import FluidHeight from 'sentry/views/replays/detail/layout/fluidHeight';

type Props = {
  event: Event;
  orgSlug: string;
  replaySlug: string;
};

function ReplayContent({orgSlug, replaySlug, event}: Props) {
  const routes = useRoutes();
  const {fetching, replay, fetchError} = useReplayData({
    orgSlug,
    replaySlug,
  });
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

  const fullReplayUrl = {
    pathname: `/organizations/${orgSlug}/replays/${replaySlug}/`,
    query: {
      referrer: getRouteStringFromRoutes(routes),
      t_main: 'console',
      t: initialTimeOffset,
    },
  };

  return (
    <ReplayContextProvider replay={replay} initialTimeOffset={initialTimeOffset}>
      <PlayerContainer data-test-id="player-container">
        <BadgeContainer>
          <FeatureText>{t('Replays')}</FeatureText>
          <ReplaysFeatureBadge />
        </BadgeContainer>
        <FluidHeight>
          <CTAOverlayLink aria-label={t('View Full Replay')} to={fullReplayUrl}>
            <CTAIcon />
          </CTAOverlayLink>

          <StaticPanel>
            <ReplayPlayer />
          </StaticPanel>
        </FluidHeight>

        <CTAButtonContainer>
          <Button
            data-test-id="view-replay-button"
            to={fullReplayUrl}
            priority="primary"
            size="sm"
            icon={<IconPlay size="sm" />}
          >
            {t('View Full Replay')}
          </Button>
        </CTAButtonContainer>
      </PlayerContainer>
    </ReplayContextProvider>
  );
}

const PlayerContainer = styled(FluidHeight)`
  position: relative;
  margin-bottom: ${space(2)};
  background: ${p => p.theme.background};
  gap: ${space(1)};
  max-height: 448px;
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

const CTAOverlayLink = styled(Link)`
  position: absolute;
  width: 100%;
  height: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1;
`;

const CTAIcon = styled(({className}: {className?: string}) => (
  <div className={className}>
    <IconPlay size="xl" />
  </div>
))`
  display: flex;
  justify-content: center;
  align-items: center;
  width: 72px;
  height: 72px;
  border-radius: 50%;
  background: ${p => p.theme.purple400};
  color: white;
  padding-left: 5px; /* Align the icon in the center of the circle */
`;

const StaticPanel = styled(FluidHeight)`
  background: ${p => p.theme.background};
  border: 1px solid ${p => p.theme.border};
  border-radius: ${p => p.theme.borderRadius};
  box-shadow: ${p => p.theme.dropShadowLight};
`;

const CTAButtonContainer = styled('div')`
  display: flex;
  justify-content: flex-end;
`;

const StyledPlaceholder = styled(Placeholder)`
  margin-bottom: ${space(2)};
`;

export default ReplayContent;
