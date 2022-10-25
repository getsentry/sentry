import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';
import {textWithMarkupMatcher} from 'sentry-test/utils';

import {Csp} from 'sentry/components/events/interfaces/csp';
import {EntryType} from 'sentry/types/event';

describe('Csp report entry', function () {
  it('display redacted data', async function () {
    const event = {
      ...TestStubs.Event(),
      entries: [{type: EntryType.CSP, data: {effective_directive: ''}}],
      _meta: {
        entries: {
          0: {
            data: {
              effective_directive: {'': {rem: [['organization:1', 'x']]}},
            },
          },
        },
      },
    };
    render(<Csp data={event.entries[0].data} event={event} />, {
      organization: {
        relayPiiConfig: JSON.stringify(TestStubs.DataScrubbingRelayPiiConfig()),
      },
    });

    expect(screen.getByText(/redacted/)).toBeInTheDocument();

    userEvent.hover(screen.getByText(/redacted/));

    expect(
      await screen.findByText(
        textWithMarkupMatcher(
          "Removed because of the data scrubbing rule [Mask] [Credit card numbers] from [$message] in your organization's settings"
        )
      )
    ).toBeInTheDocument(); // tooltip description
  });
});
