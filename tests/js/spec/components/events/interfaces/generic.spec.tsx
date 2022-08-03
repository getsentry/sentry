import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {Generic} from 'sentry/components/events/interfaces/generic';

describe('Generic entry', function () {
  it('display redacted data', async function () {
    const event = {
      ...TestStubs.Event(),
      _meta: {
        hpkp: {'': {rem: [['project:1', 'x']]}},
      },
    };
    render(<Generic type="hpkp" data={null} meta={event._meta.hpkp} />);

    expect(screen.getByText(/redacted/)).toBeInTheDocument();

    userEvent.hover(screen.getByText(/redacted/));

    expect(
      await screen.findByText('Removed because of PII rule "project:1"')
    ).toBeInTheDocument(); // tooltip description
  });
});
