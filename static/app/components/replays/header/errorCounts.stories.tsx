import {Flex} from 'sentry/components/core/layout/flex';
import ErrorCounts from 'sentry/components/replays/header/errorCounts';
import ReplaySlugChooser from 'sentry/components/replays/player/__stories__/replaySlugChooser';
import * as Storybook from 'sentry/stories';
import {useReplayReader} from 'sentry/utils/replays/playback/providers/replayReaderProvider';
import type {ErrorFrame, RawReplayError} from 'sentry/utils/replays/types';

function errorFramesToRawReplayErrors(errorFrames: ErrorFrame[]): RawReplayError[] {
  return errorFrames.map(
    errorFrame =>
      ({
        'project.name': errorFrame.data.projectSlug,
        'error.type': errorFrame.data.labels,
        id: errorFrame.data.eventId,
        issue: errorFrame.data.label,
        'issue.id': errorFrame.data.groupId,
        timestamp: errorFrame.timestamp.toISOString(),
        level: errorFrame.data.level,
        title: errorFrame.data.label,
      }) as RawReplayError
  );
}

export default Storybook.story('Timeline', story => {
  story('Default', () => {
    function Example() {
      const replay = useReplayReader();
      if (!replay) {
        return null;
      }
      return (
        <Flex gap="md">
          <ErrorCounts
            replayErrors={errorFramesToRawReplayErrors(replay.getErrorFrames())}
          />
        </Flex>
      );
    }
    return (
      <ReplaySlugChooser>
        <Example />
      </ReplaySlugChooser>
    );
  });
});
