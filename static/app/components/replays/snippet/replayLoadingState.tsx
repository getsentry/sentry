import type {ReactNode} from 'react';

import {Flex} from 'sentry/components/container/flex';
import {Alert} from 'sentry/components/core/alert';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import MissingReplayAlert from 'sentry/components/replays/alerts/missingReplayAlert';
import {IconDelete} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
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
  renderError,
  renderLoading,
}: {
  children: (props: {replay: ReplayReader}) => ReactNode;
  replaySlug: string;
  clipWindow?: ClipWindow;
  renderError?: (results: ReplayReaderResult) => ReactNode;
  renderLoading?: (resuls: ReplayReaderResult) => ReactNode;
}) {
  const organization = useOrganization();
  const readerResult = useLoadReplayReader({
    orgSlug: organization.slug,
    replaySlug,
    clipWindow,
  });
  const {
    replay,
    replayId,
    attachments,
    errors,
    fetchError,
    fetching,
    onRetry,
    projectSlug,
    replayRecord,
  } = readerResult;

  if (fetchError) {
    return (
      renderError?.(readerResult) ?? <MissingReplayAlert orgSlug={organization.slug} />
    );
  }
  if (fetching) {
    return renderLoading?.(readerResult) ?? <LoadingIndicator />;
  }
  if (!replay) {
    return renderLoading?.(readerResult) ?? <LoadingIndicator />;
  }
  if (replayRecord?.is_archived) {
    return (
      <Alert type="warning" data-test-id="replay-error">
        <Flex gap={space(0.5)}>
          <IconDelete color="gray500" size="sm" />
          {t('The replay for this event has been deleted.')}
        </Flex>
      </Alert>
    );
  }
  return children({replay});
}
