import * as Sentry from '@sentry/react';
import {RRWebInitFrameEventsFixture} from 'sentry-fixture/replay/rrweb';
import {ReplayRecordFixture} from 'sentry-fixture/replayRecord';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import {ReplayProcessingError} from 'sentry/components/replays/replayProcessingError';
import {ReplayReader} from 'sentry/utils/replays/replayReader';

function renderProcessingError() {
  const replay = ReplayReader.factory({
    attachments: RRWebInitFrameEventsFixture({
      timestamp: new Date('2023-12-25T00:02:00'),
    }),
    errors: [],
    fetching: false,
    replayRecord: ReplayRecordFixture(),
  });

  return render(<ReplayProcessingError replay={replay} />);
}

describe('ReplayProcessingError', () => {
  it('renders an explanation when the replay cannot be processed', () => {
    renderProcessingError();

    expect(screen.getByText('Replay Not Found')).toBeInTheDocument();
  });

  it('reports the processing errors to Sentry when mounted', () => {
    const captureMessage = jest.spyOn(Sentry, 'captureMessage');

    renderProcessingError();

    expect(captureMessage).toHaveBeenCalledWith('Replay processing error');
  });
});
