import {EventFixture} from 'sentry-fixture/event';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import {ContextCard} from 'sentry/components/events/contexts/contextCard';
import {
  getReactNativeContextData,
  type ReactNativeContext,
} from 'sentry/components/events/contexts/knownContext/reactNativeContext';

const MOCK_REACT_NATIVE_CONTEXT: ReactNativeContext = {
  expo: false,
  fabric: true,
  hermes_debug_info: false,
  hermes_version: '250829098.0.10',
  js_engine: 'hermes',
  react_native_version: '0.85.1',
  turbo_module: true,
  // Extra data is still valid and preserved
  extra_data: 'something',
  unknown_key: 123,
};

const MOCK_REDACTION = {
  hermes_version: {
    '': {
      rem: [['organization:0', 's', 0, 0]],
      len: 15,
    },
  },
};

describe('ReactNativeContext', () => {
  it('returns values according to the parameters', () => {
    expect(getReactNativeContextData({data: MOCK_REACT_NATIVE_CONTEXT})).toEqual([
      {key: 'expo', subject: 'Expo', value: false},
      {key: 'fabric', subject: 'Fabric', value: true},
      {key: 'hermes_debug_info', subject: 'Hermes Debug Info', value: false},
      {
        key: 'hermes_version',
        subject: 'Hermes Version',
        value: '250829098.0.10',
      },
      {key: 'js_engine', subject: 'JS Engine', value: 'hermes'},
      {
        key: 'react_native_version',
        subject: 'React Native Version',
        value: '0.85.1',
      },
      {key: 'turbo_module', subject: 'Turbo Module', value: true},
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
      _meta: {contexts: {react_native_context: MOCK_REDACTION}},
    });

    render(
      <ContextCard
        event={event}
        type="react_native_context"
        alias="react_native_context"
        value={{...MOCK_REACT_NATIVE_CONTEXT, hermes_version: ''}}
      />
    );

    expect(screen.getByText('React Native')).toBeInTheDocument();
    expect(screen.getByText('JS Engine')).toBeInTheDocument();
    expect(screen.getByText('hermes')).toBeInTheDocument();
    expect(screen.getByText('Hermes Version')).toBeInTheDocument();
    expect(screen.getByText(/redacted/)).toBeInTheDocument();
  });
});
