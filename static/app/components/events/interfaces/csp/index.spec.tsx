import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';
import {textWithMarkupMatcher} from 'sentry-test/utils';

import {Csp} from 'sentry/components/events/interfaces/csp';
import {EntryType} from 'sentry/types/event';
import {OrganizationContext} from 'sentry/views/organizationContext';
import {RouteContext} from 'sentry/views/routeContext';

describe('Csp report entry', function () {
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
      entries: [{type: EntryType.CSP, data: {effective_directive: ''}}],
      _meta: {
        entries: {
          0: {
            data: {
              effective_directive: {'': {rem: [['organization:1', 'x']]}},
            },
          },
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
          <Csp data={event.entries[0].data} event={event} />
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
