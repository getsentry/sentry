import * as Sentry from '@sentry/react';
import {RRWebInitFrameEventsFixture} from 'sentry-fixture/replay/rrweb';
import {ReplayRecordFixture} from 'sentry-fixture/replayRecord';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import {ReplayProcessingError} from 'sentry/components/replays/replayProcessingError';
import {ReplayReader} from 'sentry/utils/replays/replayReader';

function makeReplay() {
  return ReplayReader.factory({
    attachments: RRWebInitFrameEventsFixture({
      timestamp: new Date('2023-12-25T00:02:00'),
    }),
    errors: [],
    fetching: false,
    replayRecord: ReplayRecordFixture(),
  });
}

function renderProcessingError() {
  return render(<ReplayProcessingError replay={makeReplay()} />);
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

  it('reports only once when the reader is rebuilt', () => {
    const captureMessage = jest.spyOn(Sentry, 'captureMessage');
    const {rerender} = render(<ReplayProcessingError replay={makeReplay()} />);

    rerender(<ReplayProcessingError replay={makeReplay()} />);

    expect(captureMessage).toHaveBeenCalledTimes(1);
  });
});
