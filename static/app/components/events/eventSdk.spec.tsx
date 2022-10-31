import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';
import {textWithMarkupMatcher} from 'sentry-test/utils';

import {EventSdk} from 'sentry/components/events/eventSdk';

describe('event sdk', function () {
  it('display redacted tags', async function () {
    const event = {
      ...TestStubs.Event(),
      sdk: {
        name: 'sentry.cocoa',
        version: '',
      },
      _meta: {
        sdk: {
          version: {'': {rem: [['organization:0', 'x']]}},
        },
      },
    };

    render(<EventSdk sdk={event.sdk} meta={event._meta.sdk} />, {
      organization: {
        relayPiiConfig: JSON.stringify(TestStubs.DataScrubbingRelayPiiConfig()),
      },
    });

    userEvent.hover(screen.getByText(/redacted/));
    expect(
      await screen.findByText(
        textWithMarkupMatcher(
          "Removed because of the data scrubbing rule [Replace] [Password fields] with [Scrubbed] from [password] in your organization's settings"
        )
      )
    ).toBeInTheDocument(); // tooltip description
  });
});
