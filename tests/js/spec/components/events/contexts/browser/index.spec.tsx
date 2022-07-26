import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {BrowserEventContext} from 'sentry/components/events/contexts/browser';

export const browserMockData = {
  version: '83.0.4103',
  type: 'browser',
  name: '',
};

export const browserMetaMockData = {
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
      rem: [['project:0', 'x', 0, 0]],
    },
  },
};

const event = {
  ...TestStubs.Event(),
  _meta: {
    contexts: {
      browser: browserMetaMockData,
    },
  },
};

describe('browser event context', function () {
  it('display redacted data', async function () {
    render(<BrowserEventContext event={event} data={browserMockData} />);

    expect(screen.getByText('Name')).toBeInTheDocument(); // subject
    expect(screen.getByText(/redacted/)).toBeInTheDocument(); // value
    userEvent.hover(screen.getByText(/redacted/));
    expect(
      await screen.findByText('Removed because of PII rule "project:0"')
    ).toBeInTheDocument(); // tooltip description
  });
});
