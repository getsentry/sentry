import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';
import {textWithMarkupMatcher} from 'sentry-test/utils';

import {EventPackageData} from 'sentry/components/events/packageData';

describe('EventPackageData', function () {
  it('display redacted data', async function () {
    const event = {
      ...TestStubs.Event(),
      packages: {
        certifi: '',
        pip: '18.0',
        python: '2.7.15',
        'sentry-sdk': '0.3.1',
        setuptools: '40.0.0',
        urllib3: '1.23',
        wheel: '0.31.1',
        wsgiref: '0.1.2',
      },
      _meta: {
        packages: {
          certifi: {'': {rem: [['organization:1', 'x']]}},
        },
      },
    };

    render(<EventPackageData event={event} />, {
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
