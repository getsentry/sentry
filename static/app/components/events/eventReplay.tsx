import styled from '@emotion/styled';

import EventDataSection from 'sentry/components/events/eventDataSection';
import Link from 'sentry/components/links/link';
import Placeholder from 'sentry/components/placeholder';
import {Provider as ReplayContextProvider} from 'sentry/components/replays/replayContext';
import ReplayView from 'sentry/components/replays/replayView';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import useFullscreen from 'sentry/utils/replays/hooks/useFullscreen';
import useReplayData from 'sentry/utils/replays/hooks/useReplayData';
import FluidHeight from 'sentry/views/replays/detail/layout/fluidHeight';

type Props = {
  orgSlug: string;
  projectSlug: string;
  replayId: string;
};

export default function EventReplay({replayId, orgSlug, projectSlug}: Props) {
  const {fetching, replay} = useReplayData({
    eventSlug: `${projectSlug}:${replayId}`,
    orgId: orgSlug,
  });

  const {ref: fullscreenRef, toggle: toggleFullscreen} = useFullscreen();

  return (
    <EventDataSection type="replay" title={t('Replay')}>
      <Link to={`/organizations/${orgSlug}/replays/${projectSlug}:${replayId}`}>
        {replayId}
      </Link>

      <ReplayContextProvider replay={replay} initialTimeOffset={0}>
        <PlayerContainer ref={fullscreenRef}>
          {fetching ? (
            <Placeholder height="350px" width="100%" />
          ) : (
            <ReplayView toggleFullscreen={toggleFullscreen} />
          )}
        </PlayerContainer>
      </ReplayContextProvider>
    </EventDataSection>
  );
}

const PlayerContainer = styled(FluidHeight)`
  max-width: 420px;
  margin-top: ${space(2)};

  background: ${p => p.theme.background};
  gap: ${space(1)};
`;
