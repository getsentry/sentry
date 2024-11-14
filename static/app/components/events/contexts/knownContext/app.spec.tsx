import {EventFixture} from 'sentry-fixture/event';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import ContextCard from 'sentry/components/events/contexts/contextCard';
import {
  type AppContext,
  getAppContextData,
} from 'sentry/components/events/contexts/knownContext/app';

const MOCK_APP_CONTEXT: AppContext = {
  device_app_hash: '2421fae1ac9237a8131e74883e52b0f7034a143f',
  build_type: 'test',
  app_identifier: 'io.sentry.sample.iOS-Swift',
  app_name: '',
  app_version: '7.1.3',
  app_build: '1',
  app_id: '3145EA1A-0EAE-3F8C-969A-13A01394D3EA',
  type: 'app',
  in_foreground: false,
  app_memory: 1048576 * 12,
  view_names: ['app.view1', 'app.view2'],
  // Extra data is still valid and preserved
  extra_data: 'something',
  unknown_key: 123,
};

const MOCK_REDACTION = {
  app_name: {
    '': {
      chunks: [
        {
          remark: 'x',
          rule_id: 'organization:0',
          text: '',
          type: 'redaction',
        },
      ],
      len: 9,
      rem: [['organization:0', 'x', 0, 0]],
    },
  },
};

describe('AppContext', function () {
  it('returns values and according to the parameters', function () {
    expect(getAppContextData({data: MOCK_APP_CONTEXT, event: EventFixture()})).toEqual([
      {
        key: 'device_app_hash',
        subject: 'Device',
        value: '2421fae1ac9237a8131e74883e52b0f7034a143f',
      },
      {key: 'build_type', subject: 'Build Type', value: 'test'},
      {
        key: 'app_identifier',
        subject: 'Build ID',
        value: 'io.sentry.sample.iOS-Swift',
      },
      {key: 'app_name', subject: 'Build Name', value: ''},
      {key: 'app_version', subject: 'Version', value: '7.1.3'},
      {key: 'app_build', subject: 'App Build', value: '1'},
      {
        key: 'app_id',
        subject: 'ID',
        value: '3145EA1A-0EAE-3F8C-969A-13A01394D3EA',
      },
      {key: 'in_foreground', subject: 'In Foreground', value: false},
      {key: 'app_memory', subject: 'Memory Usage', value: '12.0 MiB'},
      {
        key: 'view_names',
        subject: 'View Names',
        value: ['app.view1', 'app.view2'],
      },
      {
        key: 'extra_data',
        subject: 'extra_data',
        value: 'something',
      },
      {
        key: 'unknown_key',
        subject: 'unknown_key',
        value: 123,
      },
    ]);
  });

  it('renders with meta annotations correctly', function () {
    const event = EventFixture({
      _meta: {contexts: {app: MOCK_REDACTION}},
    });

    render(
      <ContextCard
        event={event}
        type={'app'}
        alias={'app'}
        value={{...MOCK_APP_CONTEXT, app_name: ''}}
      />
    );

    expect(screen.getByText('App')).toBeInTheDocument();
    expect(screen.getByText('Memory Usage')).toBeInTheDocument();
    expect(screen.getByText('12.0 MiB')).toBeInTheDocument();
    expect(screen.getByText('Build Name')).toBeInTheDocument();
    expect(screen.getByText(/redacted/)).toBeInTheDocument();
  });
});
