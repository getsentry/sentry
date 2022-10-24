import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';
import {textWithMarkupMatcher} from 'sentry-test/utils';

import {Message} from 'sentry/components/events/interfaces/message';

describe('Message entry', function () {
  it('display redacted data', async function () {
    const event = {
      ...TestStubs.Event(),
      entries: [
        {
          type: 'message',
          data: {
            formatted: null,
          },
        },
      ],
      _meta: {
        entries: {
          0: {
            data: {
              formatted: {'': {rem: [['organization:0', 'x']]}},
            },
          },
        },
      },
    };
    render(<Message data={{formatted: null}} event={event} />, {
      organization: {
        relayPiiConfig: JSON.stringify(TestStubs.DataScrubbingRelayPiiConfig()),
      },
    });

    expect(screen.getByText(/redacted/)).toBeInTheDocument();

    userEvent.hover(screen.getByText(/redacted/));

    expect(
      await screen.findByText(
        textWithMarkupMatcher(
          "Removed because of the data scrubbing rule [Replace] [Password fields] with [Scrubbed] from [password] in your organization's settings"
        )
      )
    ).toBeInTheDocument(); // tooltip description

    expect(
      screen.getByRole('link', {
        name: '[Replace] [Password fields] with [Scrubbed] from [password]',
      })
    ).toHaveAttribute(
      'href',
      '/settings/org-slug/security-and-privacy/advanced-data-scrubbing/0/'
    );

    expect(screen.getByRole('link', {name: "organization's settings"})).toHaveAttribute(
      'href',
      '/settings/org-slug/security-and-privacy/'
    );
  });
});
