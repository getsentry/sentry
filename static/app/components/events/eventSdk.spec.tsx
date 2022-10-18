import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';
import {textWithMarkupMatcher} from 'sentry-test/utils';

import {EventSdk} from 'sentry/components/events/eventSdk';
import {OrganizationContext} from 'sentry/views/organizationContext';
import {RouteContext} from 'sentry/views/routeContext';

describe('event sdk', function () {
  it('display redacted tags', async function () {
    const {organization, router} = initializeOrg({
      ...initializeOrg(),
      organization: {
        ...initializeOrg().organization,
        relayPiiConfig: JSON.stringify(TestStubs.DataScrubbingRelayPiiConfig()),
      },
    });

    const event = {
      ...TestStubs.Event(),
      sdk: {
        name: 'sentry.cocoa',
        version: '',
      },
      _meta: {
        sdk: {
          version: {'': {rem: [['organization:0', 'x']]}},
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
          <EventSdk sdk={event.sdk} meta={event._meta.sdk} />
        </RouteContext.Provider>
      </OrganizationContext.Provider>
    );

    userEvent.hover(screen.getByText(/redacted/));
    expect(
      await screen.findByText(
        textWithMarkupMatcher(
          "Removed because of the data scrubbing rule [Replace] [Password fields] with [Scrubbed] from [password] in your organization's settings"
        )
      )
    ).toBeInTheDocument(); // tooltip description
  });
});
