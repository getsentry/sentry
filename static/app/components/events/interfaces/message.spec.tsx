import {DataScrubbingRelayPiiConfigFixture} from 'sentry-fixture/dataScrubbingRelayPiiConfig';
import {EventFixture} from 'sentry-fixture/event';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';
import {textWithMarkupMatcher} from 'sentry-test/utils';

import {Message} from 'sentry/components/events/interfaces/message';

describe('Message entry', () => {
  it('display redacted data', async () => {
    const event = EventFixture({
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
    });
    render(<Message data={{formatted: null}} event={event} />, {
      organization: {
        relayPiiConfig: JSON.stringify(DataScrubbingRelayPiiConfigFixture()),
      },
    });

    expect(screen.getByText(/redacted/)).toBeInTheDocument();

    await userEvent.hover(screen.getByText(/redacted/));

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

  it('renders colored text and links without escape codes when given an ANSI message', () => {
    const formatted = '\x1B[31mfailed\x1B[0m to fetch https://example.com/status';
    const event = EventFixture({
      entries: [{type: 'message', data: {formatted}}],
    });

    render(<Message data={{formatted}} event={event} />);

    expect(screen.getByText('failed').closest('pre')).toHaveTextContent(
      /^failed to fetch https:\/\/example\.com\/status$/
    );
    expect(screen.getByText('failed').style.color).toContain('color-mix(in srgb,');
    expect(screen.getByText('https://example.com/status').tagName).toBe('A');
  });
});
