import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';
import {textWithMarkupMatcher} from 'sentry-test/utils';

import {TagsTable} from 'sentry/components/tagsTable';
import {OrganizationContext} from 'sentry/views/organizationContext';
import {RouteContext} from 'sentry/views/routeContext';

describe('tags table', function () {
  it('display redacted tag value', async function () {
    const tags = [
      {key: 'gpu.name', value: null},
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

    const {organization, router} = initializeOrg();

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
          <TagsTable
            event={event}
            query="transaction.duration:<15m transaction.op:pageload"
            generateUrl={jest.fn()}
          />
        </RouteContext.Provider>
      </OrganizationContext.Provider>
    );

    userEvent.hover(screen.getByText(/redacted/));

    expect(
      await screen.findByText(
        textWithMarkupMatcher(
          "Removed because of a data scrubbing rule in your project's settings"
        ) // Fall back case
      )
    ).toBeInTheDocument(); // tooltip description
  });

  it('display redacted tag key', async function () {
    const {organization, router} = initializeOrg();

    const tags = [
      {key: 'gpu.name', value: 'AMD Radeon Pro 560'},
      {key: null, value: 'iOS'},
    ];

    const event = {
      ...TestStubs.Event(),
      tags,
      _meta: {
        tags: {
          '1': {
            key: {
              '': {rem: [['project:2', 'x']]},
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
          <TagsTable
            event={event}
            query="transaction.duration:<15m transaction.op:pageload"
            generateUrl={jest.fn()}
          />
        </RouteContext.Provider>
      </OrganizationContext.Provider>
    );

    userEvent.hover(screen.getByText(/redacted/));

    expect(
      await screen.findByText(
        textWithMarkupMatcher(
          "Removed because of a data scrubbing rule in your project's settings"
        ) // Fall back case
      )
    ).toBeInTheDocument(); // tooltip description
  });
});
