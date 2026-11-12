import type {ReactNode} from 'react';

import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {ArchivedReplayAlert} from 'sentry/components/replays/alerts/archivedReplayAlert';
import {MissingReplayAlert} from 'sentry/components/replays/alerts/missingReplayAlert';
import {ReplayRequestsThrottledAlert} from 'sentry/components/replays/alerts/replayRequestsThrottledAlert';
import {ReplayProcessingError} from 'sentry/components/replays/replayProcessingError';
import type {useLoadReplayReader} from 'sentry/utils/replays/hooks/useLoadReplayReader';
import type {ReplayReader} from 'sentry/utils/replays/replayReader';
import {isRateLimitError} from 'sentry/utils/requestError/requestError';
import {useOrganization} from 'sentry/utils/useOrganization';

type ReplayReaderResult = ReturnType<typeof useLoadReplayReader>;

export function ReplayLoadingState({
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
    isRateLimitError(readerResult.fetchError) ||
    readerResult.attachmentError?.find(isRateLimitError);

  if (throttledErrorExists) {
    return renderThrottled ? (
      renderThrottled(readerResult)
    ) : (
      <ReplayRequestsThrottledAlert />
    );
  }
  if (readerResult.replayRecord?.is_archived) {
    return renderArchived ? renderArchived(readerResult) : <ArchivedReplayAlert />;
  }
  if (readerResult.fetchError || readerResult.attachmentError?.length) {
    return renderError ? (
      renderError(readerResult)
    ) : (
      <MissingReplayAlert orgSlug={organization.slug} />
    );
  }
  if (readerResult.isPending) {
    return renderLoading ? renderLoading(readerResult) : <LoadingIndicator />;
  }
  if (!readerResult.replay) {
    return renderMissing ? (
      renderMissing(readerResult)
    ) : (
      <MissingReplayAlert orgSlug={organization.slug} />
    );
  }

  if (readerResult.replay.hasProcessingErrors()) {
    return renderProcessingError ? (
      renderProcessingError(readerResult)
    ) : (
      <ReplayProcessingError />
    );
  }
  return children({replay: readerResult.replay});
}
