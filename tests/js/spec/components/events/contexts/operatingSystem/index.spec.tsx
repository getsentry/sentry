import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {OperatingSystemEventContext} from 'sentry/components/events/contexts/operatingSystem';

export const operatingSystemMockData = {
  name: 'Mac OS X 10.14.0',
  version: '',
  raw_description: '',
  build: '',
  kernel_version: '',
};

export const operatingSystemMetaMockData = {
  raw_description: {
    '': {
      chunks: [
        {
          remark: 'x',
          rule_id: 'project:0',
          text: '',
          type: 'redaction',
        },
      ],
      len: 9,
      rem: [['project:0', 'x', 0, 0]],
    },
  },
};

const event = {
  ...TestStubs.Event(),
  _meta: {
    contexts: {
      os: operatingSystemMetaMockData,
    },
  },
};

describe('operating system event context', function () {
  it('display redacted data', async function () {
    render(<OperatingSystemEventContext event={event} data={operatingSystemMockData} />);

    expect(screen.getByText('Raw Description')).toBeInTheDocument(); // subject
    userEvent.hover(screen.getByText(/redacted/));
    expect(
      await screen.findByText('Removed because of PII rule "project:0"')
    ).toBeInTheDocument(); // tooltip description
  });
});
