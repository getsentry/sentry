import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

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
              effective_directive: {'': {rem: [['project:1', 'x']]}},
            },
          },
        },
      },
    };
    render(<Csp data={event.entries[0].data} event={event} />);

    expect(screen.getByText(/redacted/)).toBeInTheDocument();

    userEvent.hover(screen.getByText(/redacted/));

    expect(
      await screen.findByText('Removed because of PII rule "project:1"')
    ).toBeInTheDocument(); // tooltip description
  });
});
