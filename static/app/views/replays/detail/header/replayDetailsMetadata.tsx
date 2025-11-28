import {Flex} from 'sentry/components/core/layout';
import Placeholder from 'sentry/components/placeholder';
import ReplayMetaData from 'sentry/components/replays/header/replayMetaData';
import ReplayLoadingState from 'sentry/components/replays/player/replayLoadingState';
import type useLoadReplayReader from 'sentry/utils/replays/hooks/useLoadReplayReader';

interface Props {
  readerResult: ReturnType<typeof useLoadReplayReader>;
}

export default function ReplayDetailsMetadata({readerResult}: Props) {
  return (
    <ReplayLoadingState
      readerResult={readerResult}
      renderArchived={() => null}
      renderError={() => null}
      renderThrottled={() => null}
      renderLoading={() => (
        <Flex justify="end">
          <Placeholder height="42px" width="276px" />
        </Flex>
      )}
      renderMissing={() => null}
      renderProcessingError={() => null}
    >
      {({replay}) => (
        <ReplayMetaData
          replayErrors={readerResult.errors}
          replayRecord={replay.getReplay()}
          showDeadRageClicks={!replay.isVideoReplay()}
        />
      )}
    </ReplayLoadingState>
  );
}
