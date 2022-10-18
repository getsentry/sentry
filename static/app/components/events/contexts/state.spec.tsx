import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';
import {textWithMarkupMatcher} from 'sentry-test/utils';

import {StateEventContext} from 'sentry/components/events/contexts/state';
import {OrganizationContext} from 'sentry/views/organizationContext';
import {RouteContext} from 'sentry/views/routeContext';

describe('StateContext', function () {
  it('renders', function () {
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
          <StateEventContext
            data={{
              state: {
                type: 'redux',
                value: {
                  a: 'abc',
                },
              },
              otherState: {
                value: {
                  b: 'bcd',
                },
              },
            }}
            event={TestStubs.Event()}
          />
        </RouteContext.Provider>
      </OrganizationContext.Provider>
    );

    expect(screen.getByText('State (Redux)')).toBeInTheDocument();
    expect(screen.getByText('otherState')).toBeInTheDocument();

    expect(screen.getByText(textWithMarkupMatcher('{a: abc}'))).toBeInTheDocument();
    expect(screen.getByText(textWithMarkupMatcher('{b: bcd}'))).toBeInTheDocument();
  });

  it('display redacted data', async function () {
    const event = {
      ...TestStubs.Event(),
      _meta: {
        contexts: {
          state: {
            state: {
              value: {
                '': {
                  rem: [['project:1', 's', 0, 0]],
                  len: 25,
                },
              },
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
          <StateEventContext
            data={{
              state: {
                type: 'redux',
                value: null,
              },
              otherState: {
                value: {
                  b: 'bcd',
                },
              },
            }}
            event={event}
          />
        </RouteContext.Provider>
      </OrganizationContext.Provider>
    );

    expect(screen.getByText('State (Redux)')).toBeInTheDocument();
    userEvent.hover(screen.getByText('None'));
    expect(
      await screen.findByText(
        textWithMarkupMatcher(
          "Replaced because of a data scrubbing rule in your project's settings"
        ) // Fall back case
      )
    ).toBeInTheDocument(); // tooltip description
  });
});
