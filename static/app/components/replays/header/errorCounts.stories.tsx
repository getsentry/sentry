import {Flex} from '@sentry/scraps/layout';

import ErrorCounts from 'sentry/components/replays/header/errorCounts';
import ReplaySlugChooser from 'sentry/components/replays/player/__stories__/replaySlugChooser';
import * as Storybook from 'sentry/stories';
import {useReplayReader} from 'sentry/utils/replays/playback/providers/replayReaderProvider';
import type {ErrorFrame, RawReplayError} from 'sentry/utils/replays/types';

function fixture(projectName: string): RawReplayError {
  return {
    'error.type': [] as string[],
    id: 'e123',
    issue: 'JS-374',
    'issue.id': 3740335939,
    'project.name': projectName,
    timestamp: new Date().toISOString(),
    level: 'error',
    title: 'A Redirect with :orgId param on customer domain',
  };
}

const JS_FIXTURE = fixture('my-js-app');
const PY_FIXTURE = fixture('my-py-app');
const GOLANG_FIXTURE = fixture('my-golang-app');

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
  story('Single Project', () => (
    <Flex gap="md">
      <ErrorCounts replayErrors={[JS_FIXTURE]} />
    </Flex>
  ));

  story('Two Projects', () => (
    <Flex gap="md">
      <ErrorCounts replayErrors={[JS_FIXTURE, PY_FIXTURE]} />
    </Flex>
  ));

  story('Three Projects', () => (
    <Flex gap="md">
      <ErrorCounts replayErrors={[JS_FIXTURE, PY_FIXTURE, GOLANG_FIXTURE]} />
    </Flex>
  ));

  story('For Replay', () => {
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
