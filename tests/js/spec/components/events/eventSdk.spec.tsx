import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

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
          version: {'': {rem: [['project:2', 'x']]}},
        },
      },
    };

    render(<EventSdk sdk={event.sdk} meta={event._meta.sdk} />);

    userEvent.hover(screen.getByText(/redacted/));
    expect(
      await screen.findByText('Removed because of PII rule "project:2"')
    ).toBeInTheDocument(); // tooltip description
  });
});
