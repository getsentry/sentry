// export default function TestVideo() {
//   return (
//     <video height="480" width="640" controls>
//       <source src="https://b.web.umkc.edu/burrise/html5/part4.mp4" type="video/mp4" />
//       Your browser does not support .mp4.
//     </video>
//   );
// }

import {Context, useEffect, useRef} from 'react';
import styled from '@emotion/styled';

import {Flex} from 'sentry/components/container/flex';
import {VideoReplayer} from 'sentry/components/replays/videoReplayer';
import {space} from 'sentry/styles/space';
import useReplayReader from 'sentry/utils/replays/hooks/useReplayReader';

export default function DemoReplayer() {
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

  return (
    <Flex column gap={space(4)}>
      <Story>
        <StoryTitle />
        <div ref={root} style={{height: '1000px'}} />
      </Story>
    </Flex>
  );
}
const Story = styled('section')`
  & > p {
    margin: ${space(3)} 0;
  }
`;

const StoryTitle = styled('h4')`
  border-bottom: 1px solid ${p => p.theme.border};
`;
