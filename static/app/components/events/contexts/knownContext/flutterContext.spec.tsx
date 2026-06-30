import {EventFixture} from 'sentry-fixture/event';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import {ContextCard} from 'sentry/components/events/contexts/contextCard';
import {
  getFlutterContextData,
  type FlutterContext,
} from 'sentry/components/events/contexts/knownContext/flutterContext';

const MOCK_FLUTTER_CONTEXT: FlutterContext = {
  default_route_name: '/',
  has_render_view: 'true',
  // Extra data is still valid and preserved
  extra_data: 'something',
  unknown_key: 123,
};

const MOCK_REDACTION = {
  default_route_name: {
    '': {
      rem: [['organization:0', 's', 0, 0]],
      len: 1,
    },
  },
};

describe('FlutterContext', () => {
  it('returns values according to the parameters', () => {
    expect(getFlutterContextData({data: MOCK_FLUTTER_CONTEXT})).toEqual([
      {key: 'default_route_name', subject: 'Default Route Name', value: '/'},
      {key: 'has_render_view', subject: 'Has Render View', value: 'true'},
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
      _meta: {contexts: {flutter_context: MOCK_REDACTION}},
    });

    render(
      <ContextCard
        event={event}
        type="flutter_context"
        alias="flutter_context"
        value={{...MOCK_FLUTTER_CONTEXT, default_route_name: ''}}
      />
    );

    expect(screen.getByText('Flutter')).toBeInTheDocument();
    expect(screen.getByText('Has Render View')).toBeInTheDocument();
    expect(screen.getByText('true')).toBeInTheDocument();
    expect(screen.getByText('Default Route Name')).toBeInTheDocument();
    expect(screen.getByText(/redacted/)).toBeInTheDocument();
  });
});
