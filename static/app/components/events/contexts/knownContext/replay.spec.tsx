import {EventFixture} from 'sentry-fixture/event';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import ContextCard from 'sentry/components/events/contexts/contextCard';
import {getReplayContextData} from 'sentry/components/events/contexts/knownContext/replay';

const REPLAY_ID = '61d2d7c5acf448ffa8e2f8f973e2cd36';
const MOCK_REPLAY_CONTEXT = {
  type: 'default',
  replay_id: REPLAY_ID,
  // Extra data is still valid and preserved
  extra_data: 'something',
  unknown_key: 123,
};

const MOCK_REDACTION = {
  extra_data: {
    '': {
      rem: [['organization:0', 's', 0, 0]],
      len: 5,
    },
  },
};

describe('ReplayContext', function () {
  it('returns values and according to the parameters', function () {
    expect(getReplayContextData({data: MOCK_REPLAY_CONTEXT})).toEqual([
      {
        key: 'extra_data',
        subject: 'extra_data',
        value: 'something',
        meta: undefined,
      },
      {
        key: 'unknown_key',
        subject: 'unknown_key',
        value: 123,
        meta: undefined,
      },
    ]);
  });

  it('renders with meta annotations correctly', function () {
    const event = EventFixture({
      _meta: {contexts: {replay: MOCK_REDACTION}},
    });

    render(
      <ContextCard
        event={event}
        type={'default'}
        alias={'replay'}
        value={{...MOCK_REPLAY_CONTEXT, extra_data: ''}}
      />
    );

    expect(screen.getByText('Replay')).toBeInTheDocument();
    expect(screen.getByText('unknown_key')).toBeInTheDocument();
    expect(screen.getByText('123')).toBeInTheDocument();
    expect(screen.getByText('extra_data')).toBeInTheDocument();
    expect(screen.getByText(/redacted/)).toBeInTheDocument();
  });
});
