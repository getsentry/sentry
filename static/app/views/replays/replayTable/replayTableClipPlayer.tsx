import ReplayClipPreviewPlayer from 'sentry/components/events/eventReplay/replayClipPreviewPlayer';
import {Provider as ReplayContextProvider} from 'sentry/components/replays/replayContext';
import useReplayReader from 'sentry/utils/replays/hooks/useReplayReader';

type Props = {
  replaySlug: string;
} & Omit<
  React.ComponentProps<typeof ReplayClipPreviewPlayer>,
  keyof ReturnType<typeof useReplayReader>
>;

function ReplayTableClipPlayer({analyticsContext, orgSlug, replaySlug, ...props}: Props) {
  const replayContext = useReplayReader({
    orgSlug,
    replaySlug,
  });

  const {fetching, replay} = replayContext;

  return (
    <ReplayContextProvider
      analyticsContext={analyticsContext}
      isFetching={fetching}
      replay={replay}
    >
      <ReplayClipPreviewPlayer
        analyticsContext={analyticsContext}
        orgSlug={orgSlug}
        {...props}
        {...replayContext}
      />
    </ReplayContextProvider>
  );
}
export default ReplayTableClipPlayer;
