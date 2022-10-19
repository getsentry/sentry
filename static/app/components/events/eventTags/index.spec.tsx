import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';
import {textWithMarkupMatcher} from 'sentry-test/utils';

import {EventTags} from 'sentry/components/events/eventTags';
import {OrganizationContext} from 'sentry/views/organizationContext';
import {RouteContext} from 'sentry/views/routeContext';

describe('event tags', function () {
  it('display redacted tags', async function () {
    const event = {
      ...TestStubs.Event(),
      tags: null,
      _meta: {
        tags: {'': {rem: [['project:2', 'x']]}},
      },
    };

    const {organization, project, router} = initializeOrg({
      ...initializeOrg(),
      organization: {
        ...initializeOrg().organization,
        relayPiiConfig: null,
      },
    });

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
          <EventTags
            organization={organization}
            projectId={project.id}
            location={router.location}
            event={event}
          />
        </RouteContext.Provider>
      </OrganizationContext.Provider>
    );

    userEvent.hover(screen.getByText(/redacted/));
    expect(
      await screen.findByText(
        textWithMarkupMatcher(
          "Removed because of a data scrubbing rule in your project's settings"
        )
      ) // Fall back case
    ).toBeInTheDocument(); // tooltip description
  });

  it('display redacted "app.device" tag', async function () {
    const tags = [
      {key: 'app.device', value: null},
      {key: 'device.family', value: 'iOS'},
    ];

    const event = {
      ...TestStubs.Event(),
      tags,
      _meta: {
        tags: {
          '0': {
            value: {
              '': {rem: [['project:2', 'x']]},
            },
          },
        },
      },
    };

    const {organization, project, router} = initializeOrg({
      ...initializeOrg(),
      organization: {
        ...initializeOrg().organization,
        relayPiiConfig: null,
      },
    });

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
          <EventTags
            organization={organization}
            projectId={project.id}
            location={router.location}
            event={event}
          />
        </RouteContext.Provider>
      </OrganizationContext.Provider>
    );

    expect(screen.getByText('device.family')).toBeInTheDocument();
    expect(screen.getByText('iOS')).toBeInTheDocument();

    expect(screen.getByText('app.device')).toBeInTheDocument();
    userEvent.hover(screen.getByText(/redacted/));

    expect(
      await screen.findByText(
        textWithMarkupMatcher(
          "Removed because of a data scrubbing rule in your project's settings"
        )
      ) // Fall back case
    ).toBeInTheDocument(); // tooltip description
  });
});
