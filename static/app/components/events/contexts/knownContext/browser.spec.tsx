import {EventFixture} from 'sentry-fixture/event';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import ContextCard from 'sentry/components/events/contexts/contextCard';
import {
  type BrowserContext,
  getBrowserContextData,
} from 'sentry/components/events/contexts/knownContext/browser';

const MOCK_BROWSER_CONTEXT: BrowserContext = {
  version: '83.0.4103',
  type: 'browser',
  name: '',
  // Extra data is still valid and preserved
  extra_data: 'something',
  unknown_key: 123,
};

const MOCK_REDACTION = {
  name: {
    '': {
      chunks: [
        {
          remark: 'x',
          rule_id: 'project:0',
          text: '',
          type: 'redaction',
        },
      ],
      len: 7,
      rem: [['organization:0', 'x', 0, 0]],
    },
  },
};

describe('BrowserContext', function () {
  it('returns values and according to the parameters', function () {
    expect(getBrowserContextData({data: MOCK_BROWSER_CONTEXT})).toEqual([
      {key: 'version', subject: 'Version', value: '83.0.4103'},
      {key: 'name', subject: 'Name', value: ''},
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
      _meta: {contexts: {browser: MOCK_REDACTION}},
    });

    render(
      <ContextCard
        event={event}
        type={'browser'}
        alias={'browser'}
        value={{...MOCK_BROWSER_CONTEXT, name: ''}}
      />
    );

    expect(screen.getByText('Browser')).toBeInTheDocument();
    expect(screen.getByText('Version')).toBeInTheDocument();
    expect(screen.getByText('83.0.4103')).toBeInTheDocument();
    expect(screen.getByText('Name')).toBeInTheDocument();
    expect(screen.getByText(/redacted/)).toBeInTheDocument();
  });
});
