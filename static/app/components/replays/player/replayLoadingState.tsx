import type {ReactNode} from 'react';

import LoadingIndicator from 'sentry/components/loadingIndicator';
import ArchivedReplayAlert from 'sentry/components/replays/alerts/archivedReplayAlert';
import MissingReplayAlert from 'sentry/components/replays/alerts/missingReplayAlert';
import useLoadReplayReader from 'sentry/utils/replays/hooks/useLoadReplayReader';
import type ReplayReader from 'sentry/utils/replays/replayReader';
import useOrganization from 'sentry/utils/useOrganization';

type ClipWindow = {
  // When to stop the replay, given it continues into that time
  endTimestampMs: number;

  // When to start the replay, given its start time is early enough
  startTimestampMs: number;
};

type ReplayReaderResult = ReturnType<typeof useLoadReplayReader>;

export default function ReplayLoadingState({
  children,
  replaySlug,
  clipWindow,
  renderArchived,
  renderError,
  renderLoading,
  renderMissing,
}: {
  children: (props: {replay: ReplayReader}) => ReactNode;
  replaySlug: string;
  clipWindow?: ClipWindow;
  renderArchived?: (results: ReplayReaderResult) => ReactNode;
  renderError?: (results: ReplayReaderResult) => ReactNode;
  renderLoading?: (results: ReplayReaderResult) => ReactNode;
  renderMissing?: (results: ReplayReaderResult) => ReactNode;
}) {
  const organization = useOrganization();
  const readerResult = useLoadReplayReader({
    orgSlug: organization.slug,
    replaySlug,
    clipWindow,
  });

  if (readerResult.fetchError) {
    return (
      renderError?.(readerResult) ?? <MissingReplayAlert orgSlug={organization.slug} />
    );
  }
  if (readerResult.fetching) {
    return renderLoading?.(readerResult) ?? <LoadingIndicator />;
  }
  if (!readerResult.replay) {
    return (
      renderMissing?.(readerResult) ?? <MissingReplayAlert orgSlug={organization.slug} />
    );
  }
  if (readerResult.replayRecord?.is_archived) {
    return renderArchived?.(readerResult) ?? <ArchivedReplayAlert />;
  }
  return children({replay: readerResult.replay});
}
