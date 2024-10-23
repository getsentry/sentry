import {DataScrubbingRelayPiiConfigFixture} from 'sentry-fixture/dataScrubbingRelayPiiConfig';
import {EventFixture} from 'sentry-fixture/event';
import {LocationFixture} from 'sentry-fixture/locationFixture';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {RouterFixture} from 'sentry-fixture/routerFixture';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';
import {textWithMarkupMatcher} from 'sentry-test/utils';

import {EventPackageData} from 'sentry/components/events/packageData';

describe('EventPackageData', function () {
  const event = EventFixture({
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
  });
  const organization = OrganizationFixture({
    relayPiiConfig: JSON.stringify(DataScrubbingRelayPiiConfigFixture()),
  });

  it('changes section title depending on the platform', function () {
    render(<EventPackageData event={event} />, {
      organization,
      router: RouterFixture({
        location: LocationFixture({query: {streamline: '1'}}),
      }),
    });
    expect(screen.getByText('Packages')).toBeInTheDocument();
    render(<EventPackageData event={{...event, platform: 'csharp'}} />, {
      organization,
      router: RouterFixture({
        location: LocationFixture({query: {streamline: '1'}}),
      }),
    });
    expect(screen.getByText('Assemblies')).toBeInTheDocument();
    render(<EventPackageData event={{...event, platform: 'java'}} />, {
      organization,
      router: RouterFixture({
        location: LocationFixture({query: {streamline: '1'}}),
      }),
    });
    expect(screen.getByText('Dependencies')).toBeInTheDocument();
  });

  it('displays all the data in column format', async function () {
    render(<EventPackageData event={event} />, {
      organization,
      router: RouterFixture({
        location: LocationFixture({query: {streamline: '1'}}),
      }),
    });
    // Should be collapsed by default
    expect(screen.queryByText(/python/)).not.toBeInTheDocument();
    // Displays when open
    await userEvent.click(screen.getByText('Packages'));
    expect(screen.getByText(/python/)).toBeInTheDocument();
    expect(screen.getByText(event?.packages?.python as string)).toBeInTheDocument();
    // Respects _meta annotations
    expect(screen.getByText(/redacted/)).toBeInTheDocument();
    await userEvent.hover(screen.getByText(/redacted/));
    expect(
      await screen.findByText(
        textWithMarkupMatcher(
          "Removed because of the data scrubbing rule [Mask] [Credit card numbers] from [$message] in your organization's settings"
        )
      )
    ).toBeInTheDocument();
  });

  it('display redacted data', async function () {
    render(<EventPackageData event={event} />, {organization});

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
