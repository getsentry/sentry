import {DataScrubbingRelayPiiConfig} from 'sentry-fixture/dataScrubbingRelayPiiConfig';
import {Event as EventFixture} from 'sentry-fixture/event';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';
import {textWithMarkupMatcher} from 'sentry-test/utils';

import {Generic} from 'sentry/components/events/interfaces/generic';

describe('Generic entry', function () {
  it('display redacted data', async function () {
    const event = EventFixture({
      _meta: {
        hpkp: {'': {rem: [['organization:1', 'x']]}},
      },
    });
    render(<Generic type="hpkp" data={null} meta={event._meta?.hpkp} />, {
      organization: {
        relayPiiConfig: JSON.stringify(DataScrubbingRelayPiiConfig()),
      },
    });

    expect(screen.getByText(/redacted/)).toBeInTheDocument();

    await userEvent.hover(screen.getByText(/redacted/));

    expect(
      await screen.findByText(
        textWithMarkupMatcher(
          "Removed because of the data scrubbing rule [Mask] [Credit card numbers] from [$message] in your organization's settings"
        )
      )
    ).toBeInTheDocument(); // tooltip description
  });
});
