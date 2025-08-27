import {Provider as ReplayContextProvider} from 'sentry/components/replays/replayContext';
import useLoadReplayReader from 'sentry/utils/replays/hooks/useLoadReplayReader';
import useOrganization from 'sentry/utils/useOrganization';
import GroupReplaysPlayer from 'sentry/views/issueDetails/groupReplays/groupReplaysPlayer';

interface Props {
  replaySlug: string;
}

export default function AssertionReplayPlayer({replaySlug}: Props) {
  const organization = useOrganization();
  const readerResult = useLoadReplayReader({
    orgSlug: organization.slug,
    replaySlug,
  });
  const {status, replay} = readerResult;

  return (
    <ReplayContextProvider
      analyticsContext="replay_tab"
      isFetching={status === 'pending'}
      replay={replay}
      autoStart
    >
      <GroupReplaysPlayer
        replayReaderResult={readerResult}
        overlayContent={null}
        analyticsContext="replay_tab"
        handleBackClick={() => {}}
        handleForwardClick={() => {}}
      />
    </ReplayContextProvider>
  );
}
