import {useEffect, useRef} from 'react';

import {VideoReplayer} from 'sentry/components/replays/videoReplayer';
import useReplayReader from 'sentry/utils/replays/hooks/useReplayReader';
import useProjects from 'sentry/utils/useProjects';

export default function Airplane() {
  return (
    <div>
      <video
        height="240"
        width="320"
        controls
        poster="https://b.web.umkc.edu/burrise/html5/FirstFrame.png"
      >
        <source
          src="https://b.web.umkc.edu/burrise/html5/Airplane.mp4"
          type="video/mp4"
        />
        Your browser does not support .mp4.
      </video>
      <hr />
      <DemoReplayer />
    </div>
  );
}

const orgSlug = 'brustolin';
// const projectSlug = 'biblia';
// const replayId = '6fc24195172944c6871b5554c8d04fdc';
const projectSlug = 'tests';
const replayId = '02fbbd5b7f594afa874ebb5c92a41cff';

function DemoReplayer() {
  useProjects({slugs: [projectSlug]});

  const root = useRef<HTMLDivElement | null>(null);
  const {replay, fetching} = useReplayReader({
    replaySlug: replayId,
    orgSlug,
  });

  const videoReplayer = useRef<VideoReplayer | null>(null);

  useEffect(() => {
    if (!root.current || fetching || !replay || videoReplayer.current) {
      return;
    }
    videoReplayer.current = new VideoReplayer(replay.getVideoEvents(), {
      root: root.current,
      start: 0,
      videoApiPrefix: `/api/0/projects/${orgSlug}/${projectSlug}/replays/${replayId}/videos/`,
      onBuffer: () => {},
      onFinished: () => {},
      onLoaded: () => {},
      durationMs: replay?.getDurationMs(),
      config: {skipInactive: false, speed: 1},
    });
  }, [replay, fetching]);

  return <div ref={root} style={{height: '1000px'}} />;
}
