import {EventFixture} from 'sentry-fixture/event';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import ContextCard from 'sentry/components/events/contexts/contextCard';
import {
  getRuntimeContextData,
  type RuntimeContext,
} from 'sentry/components/events/contexts/knownContext/runtime';

const MOCK_RUNTIME_CONTEXT: RuntimeContext = {
  version: '1.7.13',
  type: 'runtime',
  raw_description: '',
  build: '2.7.18 (default, Apr 20 2020, 19:34:11) \n[GCC 8.3.0]',
  name: '',
  // Extra data is still valid and preserved
  extra_data: 'something',
  unknown_key: 123,
};

const MOCK_REDACTION = {
  raw_description: {
    '': {
      rem: [['organization:0', 's', 0, 0]],
      len: 5,
    },
  },
};

describe('RuntimeContext', function () {
  it('returns values and according to the parameters', function () {
    expect(getRuntimeContextData({data: MOCK_RUNTIME_CONTEXT})).toEqual([
      {key: 'version', subject: 'Version', value: '1.7.13'},
      {key: 'raw_description', subject: 'Raw Description', value: ''},
      {
        key: 'build',
        subject: 'Build',
        value: '2.7.18 (default, Apr 20 2020, 19:34:11) \n[GCC 8.3.0]',
      },
      {key: 'name', subject: 'Name', value: ''},
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
      _meta: {contexts: {runtime: MOCK_REDACTION}},
    });

    render(
      <ContextCard
        event={event}
        type={'runtime'}
        alias={'runtime'}
        value={{...MOCK_RUNTIME_CONTEXT, raw_description: ''}}
      />
    );

    expect(screen.getByText('Runtime')).toBeInTheDocument();
    expect(screen.getByText('Version')).toBeInTheDocument();
    expect(screen.getByText('1.7.13')).toBeInTheDocument();
    expect(screen.getByText('Raw Description')).toBeInTheDocument();
    expect(screen.getByText(/redacted/)).toBeInTheDocument();
  });
});
