import {RRWebInitFrameEventsFixture} from 'sentry-fixture/replay/rrweb';
import {ReplayRecordFixture} from 'sentry-fixture/replayRecord';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import {ReplayReader} from 'sentry/utils/replays/replayReader';

import {ReplayProcessingError} from './replayProcessingError';

describe('ReplayProcessingError', () => {
  it('uses the replay prop when rendered outside ReplayReaderProvider', () => {
    const replay = ReplayReader.factory({
      attachments: RRWebInitFrameEventsFixture({
        timestamp: new Date('2023-12-25T00:02:00'),
      }),
      errors: [],
      fetching: false,
      replayRecord: ReplayRecordFixture(),
    });

    render(<ReplayProcessingError replay={replay} />);

    expect(screen.getByText('No Screen Recording')).toBeInTheDocument();
  });
});
