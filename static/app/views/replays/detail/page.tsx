import {Flex} from '@sentry/scraps/layout';

import {NotFound} from 'sentry/components/errors/notFound';
import {ArchivedReplayAlert} from 'sentry/components/replays/alerts/archivedReplayAlert';
import {ReplayLoadingState} from 'sentry/components/replays/player/replayLoadingState';
import {ReplayProcessingError} from 'sentry/components/replays/replayProcessingError';
import type {useLoadReplayReader} from 'sentry/utils/replays/hooks/useLoadReplayReader';
import {ReplayLayout} from 'sentry/views/replays/detail/layout/replayLayout';
import {ReplayDetailsError} from 'sentry/views/replays/detail/replayDetailsError';

type Props = {
  readerResult: ReturnType<typeof useLoadReplayReader>;
};

export function ReplayDetailsPage({readerResult}: Props) {
  return (
    <ReplayLoadingState
      readerResult={readerResult}
      renderArchived={() => (
          <ArchivedReplayAlert />
      )}
      renderError={({fetchError, onRetry}) => (
          <ReplayDetailsError fetchError={fetchError} onRetry={onRetry} />
      )}
      renderThrottled={({fetchError, onRetry}) => (
          <ReplayDetailsError fetchError={fetchError} onRetry={onRetry} />
      )}
      renderLoading={({replayRecord}) => (
        <ReplayLayout isVideoReplay={false} replayRecord={replayRecord} isLoading />
      )}
      renderMissing={() => (
          <NotFound />
      )}
      renderProcessingError={() => (
          <Flex direction="column">
            <ReplayProcessingError />
          </Flex>
      )}
    >
      {({replay}) => (
        <ReplayLayout
          isVideoReplay={replay.isVideoReplay()}
          replayRecord={replay.getReplay()}
          isLoading={false}
        />
      )}
    </ReplayLoadingState>
  );
}
