import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';
import {textWithMarkupMatcher} from 'sentry-test/utils';

import {EventPackageData} from 'sentry/components/events/packageData';
import {OrganizationContext} from 'sentry/views/organizationContext';
import {RouteContext} from 'sentry/views/routeContext';

describe('EventPackageData', function () {
  it('display redacted data', async function () {
    const {organization, router} = initializeOrg({
      ...initializeOrg(),
      organization: {
        ...initializeOrg().organization,
        relayPiiConfig: JSON.stringify(TestStubs.DataScrubbingRelayPiiConfig()),
      },
    });

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

    render(
      <OrganizationContext.Provider value={organization}>
        <RouteContext.Provider
          value={{
            router,
            location: router.location,
            params: {},
            routes: [],
          }}
        >
          <EventPackageData event={event} />
        </RouteContext.Provider>
      </OrganizationContext.Provider>
    );

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
