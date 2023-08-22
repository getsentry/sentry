import styled from '@emotion/styled';

import {Provider as ReplayContextProvider} from 'sentry/components/replays/replayContext';
import ReplayView from 'sentry/components/replays/replayView';
import useInitialTimeOffsetMs from 'sentry/utils/replays/hooks/useInitialTimeOffsetMs';
import useReplayReader from 'sentry/utils/replays/hooks/useReplayReader';
import useOrganization from 'sentry/utils/useOrganization';
import ReplayTransactionContext from 'sentry/views/replays/detail/trace/replayTransactionContext';

export function ReplayPlayer({replaySlug}: {replaySlug: string}) {
  const organization = useOrganization();
  const {
    errors: _replayErrors,
    fetchError,
    fetching,
    onRetry: _onRetry,
    projectSlug,
    replay,
    replayId,
    replayRecord,
  } = useReplayReader({
    replaySlug,
    orgSlug: organization.slug,
  });

  const initialTimeOffsetMs = useInitialTimeOffsetMs({
    orgSlug: organization.slug,
    projectSlug,
    replayId,
    replayStartTimestampMs: replayRecord?.started_at.getTime(),
  });

  if (fetchError) {
    return <div>Error loading replay</div>;
  }

  return (
    <ReplayContextProvider
      isFetching={fetching}
      replay={replay}
      initialTimeOffsetMs={initialTimeOffsetMs}
    >
      <ReplayTransactionContext replayRecord={replayRecord}>
        <PlayerWrapper>
          <ReplayView toggleFullscreen={() => {}} />
        </PlayerWrapper>
      </ReplayTransactionContext>
    </ReplayContextProvider>
  );
}

const PlayerWrapper = styled('div')`
  flex: 1;
  position: relative;
  display: flex;
  flex-direction: column;
  border-bottom: 1px solid ${p => p.theme.border};

  & {
    input {
      border-radius: 0;
      border-color: transparent;
    }
    button {
      border-radius: 0;
      border-top-color: transparent;
      border-bottom-color: transparent;
    }
    > div {
      border-radius: 0;
      border-left: none;
      border-right: none;
    }
  }
`;
