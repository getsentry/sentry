import type {ReactNode} from 'react';

import LoadingIndicator from 'sentry/components/loadingIndicator';
import ArchivedReplayAlert from 'sentry/components/replays/alerts/archivedReplayAlert';
import MissingReplayAlert from 'sentry/components/replays/alerts/missingReplayAlert';
import ReplayRequestsThrottledAlert from 'sentry/components/replays/alerts/replayRequestsThrottledAlert';
import ReplayProcessingError from 'sentry/components/replays/replayProcessingError';
import type useLoadReplayReader from 'sentry/utils/replays/hooks/useLoadReplayReader';
import type ReplayReader from 'sentry/utils/replays/replayReader';
import useOrganization from 'sentry/utils/useOrganization';

type ReplayReaderResult = ReturnType<typeof useLoadReplayReader>;

export default function ReplayLoadingState({
  children,
  readerResult,
  renderArchived,
  renderError,
  renderThrottled,
  renderLoading,
  renderMissing,
  renderProcessingError,
}: {
  children: (props: {replay: ReplayReader}) => ReactNode;
  readerResult: ReplayReaderResult;
  renderArchived?: (results: ReplayReaderResult) => ReactNode;
  renderError?: (results: ReplayReaderResult) => ReactNode;
  renderLoading?: (results: ReplayReaderResult) => ReactNode;
  renderMissing?: (results: ReplayReaderResult) => ReactNode;
  renderProcessingError?: (results: ReplayReaderResult) => ReactNode;
  renderThrottled?: (results: ReplayReaderResult) => ReactNode;
}) {
  const organization = useOrganization();

  const throttledErrorExists =
    readerResult.fetchError?.status === 429 ||
    readerResult.attachmentError?.find(error => error.status === 429);

  if (throttledErrorExists) {
    return renderThrottled ? (
      renderThrottled(readerResult)
    ) : (
      <ReplayRequestsThrottledAlert />
    );
  }
  if (readerResult.fetchError) {
    console.log('ReplayLoadingState:renderError', readerResult.fetchError);
    return renderError ? (
      renderError(readerResult)
    ) : (
      <MissingReplayAlert orgSlug={organization.slug} />
    );
  }
  if (readerResult.replayRecord?.is_archived) {
    console.log('ReplayLoadingState:renderArchived');
    return renderArchived ? renderArchived(readerResult) : <ArchivedReplayAlert />;
  }
  if (readerResult.fetching || readerResult.replay?.isFetching()) {
    console.log('ReplayLoadingState:renderLoading');
    return renderLoading ? renderLoading(readerResult) : <LoadingIndicator />;
  }
  if (!readerResult.replay) {
    console.log('ReplayLoadingState:renderMissing');
    return renderMissing ? (
      renderMissing(readerResult)
    ) : (
      <MissingReplayAlert orgSlug={organization.slug} />
    );
  }
  if (readerResult.replay.hasProcessingErrors()) {
    console.log('ReplayLoadingState:renderProcessingError', {
      processingErrors: readerResult.replay.processingErrors(),
      fetching: readerResult.fetching,
      isFetching: readerResult.replay.isFetching(),
    });
    return renderProcessingError ? (
      renderProcessingError(readerResult)
    ) : (
      <ReplayProcessingError processingErrors={readerResult.replay.processingErrors()} />
    );
  }
  console.log('ReplayLoadingState:renderChildren');
  return children({replay: readerResult.replay});
}
