import {DataScrubbingRelayPiiConfigFixture} from 'sentry-fixture/dataScrubbingRelayPiiConfig';
import {EventFixture} from 'sentry-fixture/event';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';
import {textWithMarkupMatcher} from 'sentry-test/utils';

import {EventSdk} from 'sentry/components/events/eventSdk';

describe('event sdk', () => {
  it('display redacted tags', async () => {
    const event = EventFixture({
      sdk: {
        name: 'sentry.cocoa',
        version: '',
      },
      _meta: {
        sdk: {
          version: {'': {rem: [['organization:0', 'x']]}},
        },
      },
    });

    render(<EventSdk sdk={event.sdk} meta={event._meta?.sdk} />, {
      organization: {
        relayPiiConfig: JSON.stringify(DataScrubbingRelayPiiConfigFixture()),
      },
    });

    await userEvent.click(screen.getByRole('button', {name: 'View SDK Section'}));
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
