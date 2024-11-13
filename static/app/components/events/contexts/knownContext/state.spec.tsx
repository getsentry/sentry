import {EventFixture} from 'sentry-fixture/event';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import ContextCard from 'sentry/components/events/contexts/contextCard';
import {
  getStateContextData,
  type StateContext,
} from 'sentry/components/events/contexts/knownContext/state';

const MOCK_STATE_CONTEXT: StateContext = {
  state: {
    type: 'redux',
    value: {
      a: 'abc',
    },
  },
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

describe('StateContext', function () {
  it('returns values and according to the parameters', function () {
    expect(getStateContextData({data: MOCK_STATE_CONTEXT})).toEqual([
      {
        key: 'state',
        subject: 'State (Redux)',
        value: {a: 'abc'},
        meta: undefined,
      },
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
      _meta: {contexts: {state: MOCK_REDACTION}},
    });

    render(
      <ContextCard
        event={event}
        type={'default'}
        alias={'state'}
        value={{...MOCK_STATE_CONTEXT, extra_data: ''}}
      />
    );

    expect(screen.getByText('Application State')).toBeInTheDocument();
    expect(screen.getByText('State (Redux)')).toBeInTheDocument();
    expect(screen.getByRole('button', {name: '1 item'})).toBeInTheDocument();
    expect(screen.getByText('extra_data')).toBeInTheDocument();
    expect(screen.getByText(/redacted/)).toBeInTheDocument();
  });
});
