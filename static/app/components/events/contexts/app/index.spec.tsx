import {DataScrubbingRelayPiiConfig} from 'sentry-fixture/dataScrubbingRelayPiiConfig';
import {Event as EventFixture} from 'sentry-fixture/event';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';
import {textWithMarkupMatcher} from 'sentry-test/utils';

import {AppEventContext} from 'sentry/components/events/contexts/app';
import {AppData} from 'sentry/components/events/contexts/app/types';

export const appMockData: AppData = {
  device_app_hash: '2421fae1ac9237a8131e74883e52b0f7034a143f',
  build_type: 'test',
  app_identifier: 'io.sentry.sample.iOS-Swift',
  app_name: '',
  app_version: '7.1.3',
  app_build: '1',
  app_id: '3145EA1A-0EAE-3F8C-969A-13A01394D3EA',
  type: 'app',
  in_foreground: false,
};

export const appMetaMockData = {
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

const event = EventFixture({
  _meta: {
    contexts: {
      app: appMetaMockData,
    },
  },
});

describe('app event context', function () {
  it('display redacted data', async function () {
    render(<AppEventContext event={event} data={appMockData} />, {
      organization: {
        relayPiiConfig: JSON.stringify(DataScrubbingRelayPiiConfig()),
      },
    });

    expect(screen.getByText('Build Name')).toBeInTheDocument(); // subject
    expect(screen.getByText(/redacted/)).toBeInTheDocument(); // value
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
