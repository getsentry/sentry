import {EventFixture} from 'sentry-fixture/event';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import {ContextCard} from 'sentry/components/events/contexts/contextCard';
import {
  getDartContextData,
  type DartContext,
} from 'sentry/components/events/contexts/knownContext/dartContext';

const MOCK_DART_CONTEXT: DartContext = {
  compile_mode: 'debug',
  executable: 'flutter',
  resolved_executable: '/system/bin/app_process64',
  script: 'file:///main.dart',
  // Extra data is still valid and preserved
  extra_data: 'something',
  unknown_key: 123,
};

const MOCK_REDACTION = {
  script: {
    '': {
      rem: [['organization:0', 's', 0, 0]],
      len: 20,
    },
  },
};

describe('DartContext', () => {
  it('returns values according to the parameters', () => {
    expect(getDartContextData({data: MOCK_DART_CONTEXT})).toEqual([
      {key: 'compile_mode', subject: 'Compile Mode', value: 'debug'},
      {key: 'executable', subject: 'Executable', value: 'flutter'},
      {
        key: 'resolved_executable',
        subject: 'Resolved Executable',
        value: '/system/bin/app_process64',
      },
      {key: 'script', subject: 'Script', value: 'file:///main.dart'},
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

  it('renders with meta annotations correctly', () => {
    const event = EventFixture({
      _meta: {contexts: {dart_context: MOCK_REDACTION}},
    });

    render(
      <ContextCard
        event={event}
        type="dart_context"
        alias="dart_context"
        value={{...MOCK_DART_CONTEXT, script: ''}}
      />
    );

    expect(screen.getByText('Dart')).toBeInTheDocument();
    expect(screen.getByText('Compile Mode')).toBeInTheDocument();
    expect(screen.getByText('debug')).toBeInTheDocument();
    expect(screen.getByText('Script')).toBeInTheDocument();
    expect(screen.getByText(/redacted/)).toBeInTheDocument();
  });
});
