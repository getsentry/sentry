import {EventFixture} from 'sentry-fixture/event';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import ContextCard from 'sentry/components/events/contexts/contextCard';
import {
  getLaravelContextData,
  type LaravelContext,
} from 'sentry/components/events/contexts/platformContext/laravel';

const MOCK_LARAVEL_CONTEXT: LaravelContext = {
  type: 'default',
  // No known keys, but extra data is still valid and preserved
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

describe('LaravelContext', function () {
  it('returns values and according to the parameters', function () {
    expect(getLaravelContextData({data: MOCK_LARAVEL_CONTEXT})).toEqual([
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
      _meta: {contexts: {laravel: MOCK_REDACTION}},
    });

    render(
      <ContextCard
        event={event}
        type={'default'}
        alias={'laravel'}
        value={{...MOCK_LARAVEL_CONTEXT, extra_data: ''}}
      />
    );

    expect(screen.getByText('Laravel Context')).toBeInTheDocument();
    expect(screen.getByText('unknown_key')).toBeInTheDocument();
    expect(screen.getByText('123')).toBeInTheDocument();
    expect(screen.getByText('extra_data')).toBeInTheDocument();
    expect(screen.getByText(/redacted/)).toBeInTheDocument();
  });
});
