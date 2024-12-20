import {useEffect, useRef} from 'react';

import {VideoReplayer} from 'sentry/components/replays/videoReplayer';
import storyBook from 'sentry/stories/storyBook';
import useReplayReader from 'sentry/utils/replays/hooks/useReplayReader';

function DemoReplayer() {
  const root = useRef<HTMLDivElement | null>(null);
  const replayReaderResult = useReplayReader({
    replaySlug: '6fc24195172944c6871b5554c8d04fdc',
    orgSlug: 'brustolin',
  });
  useEffect(() => {
    if (
      !root.current ||
      !replayReaderResult ||
      replayReaderResult.fetching ||
      !replayReaderResult.replay
    ) {
      return;
    }
    const vidReplayer = new VideoReplayer(replayReaderResult.replay.getVideoEvents(), {
      root: root.current,
      start: 0,
      videoApiPrefix: `/api/0/projects/brustolin/biblia/replays/${replayReaderResult.replayId}/videos/`,
      onBuffer: () => {},
      onFinished: () => {},
      onLoaded: () => {},
      durationMs: replayReaderResult.replay?.getDurationMs(),
      config: {skipInactive: false, speed: 1},
    });
  }, [replayReaderResult]);

  return <div ref={root} style={{height: '1000px'}} />;
}
export default storyBook('VideoReplayer', story => {
  story('Default', () => {
    return <DemoReplayer />;
  });
});
