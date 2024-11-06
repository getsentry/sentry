import {DataScrubbingRelayPiiConfigFixture} from 'sentry-fixture/dataScrubbingRelayPiiConfig';
import {EventFixture} from 'sentry-fixture/event';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';
import {textWithMarkupMatcher} from 'sentry-test/utils';

import {OperatingSystemEventContext} from 'sentry/components/events/contexts/operatingSystem';

export const operatingSystemMockData = {
  name: 'Linux',
  version: '6.1.82',
  build: '20C69',
  kernel_version: '99.168.amzn2023.x86_64',
  rooted: true,
  theme: 'dark',
  raw_description: '',
  distribution: {
    name: 'amzn',
    version: '2023',
    pretty_name: 'Amazon Linux 2023.4.20240401',
  },
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
      rem: [['organization:0', 'x', 0, 0]],
    },
  },
};

const event = EventFixture({
  _meta: {
    contexts: {
      os: operatingSystemMetaMockData,
    },
  },
});

describe('operating system event context', function () {
  it('display redacted data', async function () {
    render(<OperatingSystemEventContext event={event} data={operatingSystemMockData} />, {
      organization: {
        relayPiiConfig: JSON.stringify(DataScrubbingRelayPiiConfigFixture()),
      },
    });

    expect(screen.getByText('Raw Description')).toBeInTheDocument(); // subject
    await userEvent.hover(screen.getByText(/redacted/));
    expect(
      await screen.findByText(
        textWithMarkupMatcher(
          "Removed because of the data scrubbing rule [Replace] [Password fields] with [Scrubbed] from [password] in your organization's settings"
        )
      )
    ).toBeInTheDocument(); // tooltip description
  });
});
