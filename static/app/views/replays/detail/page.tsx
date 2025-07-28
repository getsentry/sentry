import {Flex} from 'sentry/components/core/layout';
import NotFound from 'sentry/components/errors/notFound';
import * as Layout from 'sentry/components/layouts/thirds';
import ArchivedReplayAlert from 'sentry/components/replays/alerts/archivedReplayAlert';
import ReplayLoadingState from 'sentry/components/replays/player/replayLoadingState';
import ReplayProcessingError from 'sentry/components/replays/replayProcessingError';
import type useLoadReplayReader from 'sentry/utils/replays/hooks/useLoadReplayReader';
import ReplayLayout from 'sentry/views/replays/detail/layout/replayLayout';
import ReplayDetailsError from 'sentry/views/replays/detail/replayDetailsError';

type Props = {
  readerResult: ReturnType<typeof useLoadReplayReader>;
};

export default function ReplayDetailsPage({readerResult}: Props) {
  return (
    <ReplayLoadingState
      readerResult={readerResult}
      renderArchived={() => (
        <Layout.Page withPadding>
          <ArchivedReplayAlert />
        </Layout.Page>
      )}
      renderError={({fetchError, onRetry}) => (
        <Layout.Page withPadding>
          <ReplayDetailsError fetchError={fetchError} onRetry={onRetry} />
        </Layout.Page>
      )}
      renderThrottled={({fetchError, onRetry}) => (
        <Layout.Page withPadding>
          <ReplayDetailsError fetchError={fetchError} onRetry={onRetry} />
        </Layout.Page>
      )}
      renderLoading={({replayRecord}) => (
        <ReplayLayout isVideoReplay={false} replayRecord={replayRecord} isLoading />
      )}
      renderMissing={() => (
        <Layout.Page withPadding>
          <NotFound />
        </Layout.Page>
      )}
      renderProcessingError={({replay}) => (
        <Layout.Page withPadding>
          <Flex direction="column">
            <ReplayProcessingError processingErrors={replay!.processingErrors()} />
          </Flex>
        </Layout.Page>
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
