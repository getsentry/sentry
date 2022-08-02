import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

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
              formatted: {'': {rem: [['project:1', 'x']]}},
            },
          },
        },
      },
    };
    render(<Message data={{formatted: null}} event={event} />);

    expect(screen.getByText(/redacted/)).toBeInTheDocument();

    userEvent.hover(screen.getByText(/redacted/));

    expect(
      await screen.findByText('Removed because of PII rule "project:1"')
    ).toBeInTheDocument(); // tooltip description
  });
});
