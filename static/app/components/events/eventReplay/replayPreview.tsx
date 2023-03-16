import {useMemo} from 'react';
import styled from '@emotion/styled';

import {Alert} from 'sentry/components/alert';
import {Button} from 'sentry/components/button';
import Placeholder from 'sentry/components/placeholder';
import {Provider as ReplayContextProvider} from 'sentry/components/replays/replayContext';
import ReplayPlayer from 'sentry/components/replays/replayPlayer';
import ReplaysFeatureBadge from 'sentry/components/replays/replaysFeatureBadge';
import {relativeTimeInMs} from 'sentry/components/replays/utils';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
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

function ReplayPreview({orgSlug, replaySlug, event}: Props) {
  const routes = useRoutes();
  const {fetching, replay, fetchError} = useReplayData({
    orgSlug,
    replaySlug,
  });
  const eventTimestamp = event.dateCreated
    ? Math.floor(new Date(event.dateCreated).getTime() / 1000) * 1000
    : 0;

  const replayRecord = replay?.getReplay();

  const startTimestampMs = replayRecord?.started_at.getTime() ?? 0;

  const initialTimeOffset = useMemo(() => {
    if (eventTimestamp && startTimestampMs) {
      return relativeTimeInMs(eventTimestamp, startTimestampMs) / 1000;
    }

    return 0;
  }, [eventTimestamp, startTimestampMs]);

  if (fetchError) {
    return (
      <Alert type="info" showIcon data-test-id="replay-error">
        {t('The replay associated with this event could not be found.')}
      </Alert>
    );
  }

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
    <ReplayContextProvider
      isFetching={fetching}
      replay={replay}
      initialTimeOffset={initialTimeOffset}
    >
      <PlayerContainer data-test-id="player-container">
        <StaticPanel>
          <ReplayPlayer isPreview />
        </StaticPanel>
        <CTAOverlay>
          <Button priority="primary" to={fullReplayUrl}>
            {t('Open Replay')}
          </Button>
        </CTAOverlay>
        <BadgeContainer>
          <FeatureText>{t('Replays')}</FeatureText>
          <ReplaysFeatureBadge />
        </BadgeContainer>
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

const StaticPanel = styled(FluidHeight)`
  border: 1px solid ${p => p.theme.border};
  border-radius: ${p => p.theme.borderRadius};
`;

const CTAOverlay = styled('div')`
  position: absolute;
  width: 100%;
  height: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
  background: rgba(255, 255, 255, 0.5);
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
  box-shadow: ${p => p.theme.dropShadowLight};
  gap: 0 ${space(0.25)};
`;

const FeatureText = styled('div')`
  font-size: ${p => p.theme.fontSizeSmall};
  line-height: 0;
  color: ${p => p.theme.text};
`;

const StyledPlaceholder = styled(Placeholder)`
  margin-bottom: ${space(2)};
`;

export default ReplayPreview;
