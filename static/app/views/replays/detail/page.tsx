import {Flex, Stack} from '@sentry/scraps/layout';

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
        <Stack flex={1} padding="2xl 3xl">
          <ArchivedReplayAlert />
        </Stack>
      )}
      renderError={({fetchError, onRetry}) => (
        <Stack flex={1} padding="2xl 3xl">
          <ReplayDetailsError fetchError={fetchError} onRetry={onRetry} />
        </Stack>
      )}
      renderThrottled={({fetchError, onRetry}) => (
        <Stack flex={1} padding="2xl 3xl">
          <ReplayDetailsError fetchError={fetchError} onRetry={onRetry} />
        </Stack>
      )}
      renderLoading={({replayRecord}) => (
        <ReplayLayout isVideoReplay={false} replayRecord={replayRecord} isLoading />
      )}
      renderMissing={() => (
        <Stack flex={1} padding="2xl 3xl">
          <NotFound />
        </Stack>
      )}
      renderProcessingError={() => (
        <Stack flex={1} padding="2xl 3xl">
          <Flex direction="column">
            <ReplayProcessingError />
          </Flex>
        </Stack>
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
