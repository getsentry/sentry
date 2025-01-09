import {EventFixture} from 'sentry-fixture/event';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import ContextCard from 'sentry/components/events/contexts/contextCard';
import {
  getReactContextData,
  type ReactContext,
} from 'sentry/components/events/contexts/platformContext/react';

const MOCK_REACT_CONTEXT: ReactContext = {
  type: 'default',
  version: '17.0.2',
  // Extra data is still valid and preserved
  extra_data: 'something',
  unknown_key: 123,
};

const MOCK_REDACTION = {
  version: {
    '': {
      rem: [['organization:0', 's', 0, 0]],
      len: 5,
    },
  },
};

describe('ReactContext', function () {
  it('returns values and according to the parameters', function () {
    expect(getReactContextData({data: MOCK_REACT_CONTEXT})).toEqual([
      {
        key: 'version',
        subject: 'Version',
        value: '17.0.2',
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
      _meta: {contexts: {react: MOCK_REDACTION}},
    });

    render(
      <ContextCard
        event={event}
        type={'default'}
        alias={'react'}
        value={{...MOCK_REACT_CONTEXT, version: ''}}
      />
    );

    expect(screen.getByText('React')).toBeInTheDocument();
    expect(screen.getByText('unknown_key')).toBeInTheDocument();
    expect(screen.getByText('123')).toBeInTheDocument();
    expect(screen.getByText('Version')).toBeInTheDocument();
    expect(screen.getByText(/redacted/)).toBeInTheDocument();
  });
});
