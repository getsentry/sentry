import {Flex} from 'sentry/components/container/flex';
import NotFound from 'sentry/components/errors/notFound';
import * as Layout from 'sentry/components/layouts/thirds';
import ArchivedReplayAlert from 'sentry/components/replays/alerts/archivedReplayAlert';
import ReplayLoadingState from 'sentry/components/replays/player/replayLoadingState';
import ReplayProcessingError from 'sentry/components/replays/replayProcessingError';
import type useLoadReplayReader from 'sentry/utils/replays/hooks/useLoadReplayReader';
import ReplayDetailsProviders from 'sentry/views/replays/detail/body/replayDetailsProviders';
import ReplaysLayout from 'sentry/views/replays/detail/layout';
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
        <ReplaysLayout isVideoReplay={false} replayRecord={replayRecord} isLoading />
      )}
      renderMissing={() => (
        <Layout.Page withPadding>
          <NotFound />
        </Layout.Page>
      )}
      renderProcessingError={({replay}) => (
        <Layout.Page withPadding>
          <Flex column>
            <ReplayProcessingError processingErrors={replay!.processingErrors()} />
          </Flex>
        </Layout.Page>
      )}
    >
      {({replay}) => (
        <ReplayDetailsProviders replay={replay} projectSlug={readerResult.projectSlug}>
          <ReplaysLayout
            isVideoReplay={replay.isVideoReplay()}
            replayRecord={replay.getReplay()}
            isLoading={false}
          />
        </ReplayDetailsProviders>
      )}
    </ReplayLoadingState>
  );
}
