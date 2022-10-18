import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';
import {textWithMarkupMatcher} from 'sentry-test/utils';

import ContextSummary from 'sentry/components/events/contextSummary';
import {ContextSummaryGPU} from 'sentry/components/events/contextSummary/contextSummaryGPU';
import {ContextSummaryOS} from 'sentry/components/events/contextSummary/contextSummaryOS';
import {ContextSummaryUser} from 'sentry/components/events/contextSummary/contextSummaryUser';
import {FILTER_MASK} from 'sentry/constants';
import {OrganizationContext} from 'sentry/views/organizationContext';
import {RouteContext} from 'sentry/views/routeContext';

const CONTEXT_USER = {
  email: 'mail@example.org',
  id: '1',
};

const CONTEXT_DEVICE = {
  arch: 'x86',
  family: 'iOS',
  model: 'iPhone10,5',
  type: 'device',
};

const CONTEXT_OS = {
  kernel_version: '17.5.0',
  version: '10.13.4',
  type: 'os',
  build: '17E199',
  name: 'Mac OS X',
};

const CONTEXT_OS_SERVER = {
  kernel_version: '4.3.0',
  version: '4.3.0',
  type: 'os',
  build: '123123123',
  name: 'Linux',
};

const CONTEXT_RUNTIME = {
  version: '1.7.13',
  type: 'runtime',
  name: 'Electron',
};

const CONTEXT_BROWSER = {
  version: '65.0.3325',
  name: 'Chrome',
};

function TestComponent({children}: {children: React.ReactNode}) {
  const {organization, router} = initializeOrg();

  return (
    <OrganizationContext.Provider value={organization}>
      <RouteContext.Provider
        value={{
          router,
          location: router.location,
          params: {},
          routes: [],
        }}
      >
        {children}
      </RouteContext.Provider>
    </OrganizationContext.Provider>
  );
}

describe('ContextSummary', function () {
  describe('render()', function () {
    it('renders nothing without contexts', function () {
      const event = {
        ...TestStubs.Event(),
        id: '',
        contexts: {},
      };

      const {container} = render(
        <TestComponent>
          <ContextSummary event={event} />
        </TestComponent>
      );
      expect(container).toSnapshot();
    });

    it('renders nothing with a single user context', function () {
      const event = {
        ...TestStubs.Event(),
        id: '',
        user: CONTEXT_USER,
        contexts: {},
      };

      const {container} = render(
        <TestComponent>
          <ContextSummary event={event} />
        </TestComponent>
      );
      expect(container).toSnapshot();
    });

    it('should bail out with empty contexts', function () {
      const event = {
        ...TestStubs.Event(),
        id: '',
        user: CONTEXT_USER,
        contexts: {
          device: {},
          os: {},
        },
      };

      const {container} = render(
        <TestComponent>
          <ContextSummary event={event} />
        </TestComponent>
      );
      expect(container).toSnapshot();
    });

    it('renders at least three contexts', function () {
      const event = {
        ...TestStubs.Event(),
        id: '',
        user: CONTEXT_USER,
        contexts: {
          device: CONTEXT_DEVICE,
        },
      };

      const {container} = render(
        <TestComponent>
          <ContextSummary event={event} />
        </TestComponent>
      );
      expect(container).toSnapshot();
    });

    it('renders up to four contexts', function () {
      const event = {
        ...TestStubs.Event(),
        id: '',
        user: CONTEXT_USER,
        contexts: {
          os: CONTEXT_OS,
          browser: CONTEXT_BROWSER,
          runtime: CONTEXT_RUNTIME,
          device: CONTEXT_DEVICE, // must be omitted
        },
      };

      const {container} = render(
        <TestComponent>
          <ContextSummary event={event} />
        </TestComponent>
      );
      expect(container).toSnapshot();
    });

    it('should prefer client_os over os', function () {
      const event = {
        ...TestStubs.Event(),
        id: '',
        user: CONTEXT_USER,
        contexts: {
          client_os: CONTEXT_OS,
          os: CONTEXT_OS_SERVER,
          browser: CONTEXT_BROWSER,
          runtime: CONTEXT_RUNTIME,
        },
      };

      const {container} = render(
        <TestComponent>
          <ContextSummary event={event} />
        </TestComponent>
      );
      expect(container).toSnapshot();
    });

    it('renders client_os too', function () {
      const event = {
        ...TestStubs.Event(),
        id: '',
        user: CONTEXT_USER,
        contexts: {
          client_os: CONTEXT_OS,
          browser: CONTEXT_BROWSER,
          runtime: CONTEXT_RUNTIME,
        },
      };

      const {container} = render(
        <TestComponent>
          <ContextSummary event={event} />
        </TestComponent>
      );
      expect(container).toSnapshot();
    });

    it('should skip non-default named contexts', function () {
      const event = {
        ...TestStubs.Event(),
        id: '',
        user: CONTEXT_USER,
        contexts: {
          os: CONTEXT_OS,
          chrome: CONTEXT_BROWSER, // non-standard context
          runtime: CONTEXT_RUNTIME,
          device: CONTEXT_DEVICE,
        },
      };

      const {container} = render(
        <TestComponent>
          <ContextSummary event={event} />
        </TestComponent>
      );
      expect(container).toSnapshot();
    });

    it('should skip a missing user context', function () {
      const event = {
        ...TestStubs.Event(),
        id: '',
        contexts: {
          os: CONTEXT_OS,
          chrome: CONTEXT_BROWSER, // non-standard context
          runtime: CONTEXT_RUNTIME,
          device: CONTEXT_DEVICE,
        },
      };

      const {container} = render(
        <TestComponent>
          <ContextSummary event={event} />
        </TestComponent>
      );
      expect(container).toSnapshot();
    });
  });
});

describe('OsSummary', function () {
  describe('render()', function () {
    it('renders the version string', function () {
      const {container} = render(
        <TestComponent>
          <ContextSummaryOS
            data={{
              kernel_version: '17.5.0',
              version: '10.13.4',
              name: 'Mac OS X',
            }}
            meta={{}}
          />
        </TestComponent>
      );
      expect(container).toSnapshot();
    });

    it('renders the kernel version when no version', function () {
      const {container} = render(
        <TestComponent>
          <ContextSummaryOS
            data={{
              kernel_version: '17.5.0',
              name: 'Mac OS X',
            }}
            meta={{}}
          />
        </TestComponent>
      );
      expect(container).toSnapshot();
    });

    it('renders unknown when no version', function () {
      const {container} = render(
        <TestComponent>
          <ContextSummaryOS
            data={{
              name: 'Mac OS X',
            }}
            meta={{}}
          />
        </TestComponent>
      );
      expect(container).toSnapshot();
    });

    it('display redacted name', async function () {
      render(
        <TestComponent>
          <ContextSummaryOS
            data={{
              name: '',
              version: '10',
            }}
            meta={{
              name: {
                '': {
                  rem: [['project:0', 's', 0, 0]],
                  len: 19,
                },
              },
            }}
          />
        </TestComponent>
      );
      userEvent.hover(screen.getByText(/redacted/));
      expect(
        await screen.findByText(
          textWithMarkupMatcher(
            "Replaced because of a data scrubbing rule in your project's settings"
          ) // Fall back case
        )
      ).toBeInTheDocument(); // tooltip description
    });

    it('handles invalid data', async function () {
      render(
        <TestComponent>
          <ContextSummaryOS
            data={{
              name: false,
              version: false,
            }}
            meta={{
              name: {
                '': {
                  rem: [['project:0', 's', 0, 0]],
                  len: 19,
                },
              },
            }}
          />
        </TestComponent>
      );
      userEvent.hover(screen.getByText(/redacted/));
      expect(
        await screen.findByText(
          textWithMarkupMatcher(
            "Replaced because of a data scrubbing rule in your project's settings"
          ) // Fall back case
        )
      ).toBeInTheDocument(); // tooltip description
    });
  });
});

describe('GpuSummary', function () {
  describe('render()', function () {
    it('renders name and vendor', function () {
      const {container} = render(
        <TestComponent>
          <ContextSummaryGPU
            data={{
              name: 'Mali-T880',
              vendor_name: 'ARM',
            }}
            meta={{}}
          />
        </TestComponent>
      );
      expect(container).toSnapshot();
    });

    it('renders unknown when no vendor', function () {
      const {container} = render(
        <TestComponent>
          <ContextSummaryGPU
            data={{
              name: 'Apple A8 GPU',
            }}
            meta={{}}
          />
        </TestComponent>
      );
      expect(container).toSnapshot();
    });

    it('display redacted name', async function () {
      render(
        <TestComponent>
          <ContextSummaryGPU
            data={{
              name: '',
            }}
            meta={{
              name: {
                '': {
                  rem: [['project:0', 's', 0, 0]],
                  len: 19,
                },
              },
            }}
          />
        </TestComponent>
      );
      userEvent.hover(screen.getByText(/redacted/));
      expect(
        await screen.findByText(
          textWithMarkupMatcher(
            "Replaced because of a data scrubbing rule in your project's settings"
          )
        ) // Fall back case)
      ).toBeInTheDocument(); // tooltip description
    });
  });
});

describe('UserSummary', function () {
  describe('render', function () {
    it('prefers email, then IP, then id, then username for title', function () {
      const user1 = {
        email: 'maisey@dogsrule.com',
        ip_address: '12.31.20.12',
        id: '26',
        username: 'maiseythedog',
        name: 'Maisey Dog',
      };

      const {rerender} = render(
        <TestComponent>
          <ContextSummaryUser data={user1} meta={{}} />
        </TestComponent>
      );
      expect(screen.getByText(user1.email)).toBeInTheDocument();

      const user2 = {
        ip_address: '12.31.20.12',
        id: '26',
        username: 'maiseythedog',
        name: 'Maisey Dog',
      };

      rerender(
        <TestComponent>
          <ContextSummaryUser data={user2} meta={{}} />
        </TestComponent>
      );
      expect(screen.getByTestId('user-title')?.textContent).toEqual(user2.ip_address);

      const user3 = {
        id: '26',
        username: 'maiseythedog',
        name: 'Maisey Dog',
      };

      rerender(
        <TestComponent>
          <ContextSummaryUser
            data={{
              id: '26',
              username: 'maiseythedog',
              name: 'Maisey Dog',
            }}
            meta={{}}
          />
        </TestComponent>
      );
      expect(screen.getByTestId('user-title')?.textContent).toEqual(user3.id);

      const user4 = {
        username: 'maiseythedog',
        name: 'Maisey Dog',
      };

      rerender(
        <TestComponent>
          <ContextSummaryUser data={user4} meta={{}} />
        </TestComponent>
      );
      expect(screen.getByTestId('user-title')).toHaveTextContent(user4.username);
    });

    it('renders NoSummary if no email, IP, id, or username', function () {
      render(
        <TestComponent>
          <ContextSummaryUser
            data={{
              name: 'Maisey Dog',
            }}
            meta={{}}
          />
        </TestComponent>
      );
      expect(screen.queryByTestId('user-title')).not.toBeInTheDocument();
      expect(screen.getByTestId('no-summary-title')).toHaveTextContent('Unknown User');
    });

    it('does not use filtered values for title', function () {
      const {rerender} = render(
        <TestComponent>
          <ContextSummaryUser
            data={{
              email: FILTER_MASK,
            }}
            meta={{}}
          />
        </TestComponent>
      );
      expect(screen.queryByTestId('user-title')).not.toBeInTheDocument();
      expect(screen.getByTestId('no-summary-title')).toHaveTextContent('Unknown User');

      // TODO: currently, the IP filter just eliminates IP addresses rather than
      // filtering them like other user data, so here, where you'd expect a filtered
      // IP address, there isn't one. Add a similar entry to the above and below
      // if/when that changes.

      rerender(
        <TestComponent>
          <ContextSummaryUser
            data={{
              id: FILTER_MASK,
            }}
            meta={{}}
          />
        </TestComponent>
      );
      expect(screen.queryByTestId('user-title')).not.toBeInTheDocument();
      expect(screen.getByTestId('no-summary-title')).toHaveTextContent('Unknown User');

      rerender(
        <TestComponent>
          <ContextSummaryUser
            data={{
              username: FILTER_MASK,
            }}
            meta={{}}
          />
        </TestComponent>
      );
      expect(screen.queryByTestId('user-title')).not.toBeInTheDocument();
      expect(screen.getByTestId('no-summary-title')).toHaveTextContent('Unknown User');
    });

    it('does not use filtered values for avatar', function () {
      // id is never used for avatar purposes, but is enough to keep us from
      // ending up with a NoSummary component where the UserSummary component
      // should be

      const {rerender} = render(
        <TestComponent>
          <ContextSummaryUser
            data={{
              id: '26',
              name: FILTER_MASK,
            }}
            meta={{}}
          />
        </TestComponent>
      );
      expect(screen.getByText('?')).toBeInTheDocument();

      rerender(
        <TestComponent>
          <ContextSummaryUser
            data={{
              id: '26',
              email: FILTER_MASK,
            }}
            meta={{}}
          />
        </TestComponent>
      );
      expect(screen.getByText('?')).toBeInTheDocument();

      rerender(
        <TestComponent>
          <ContextSummaryUser
            data={{
              id: '26',
              username: FILTER_MASK,
            }}
            meta={{}}
          />
        </TestComponent>
      );
      expect(screen.getByText('?')).toBeInTheDocument();
    });

    it('display redacted email', async function () {
      render(
        <TestComponent>
          <ContextSummaryUser
            data={{
              name: 'Maisey Dog',
              email: '',
            }}
            meta={{
              email: {
                '': {
                  rem: [['project:0', 's', 0, 0]],
                  len: 19,
                },
              },
            }}
          />
        </TestComponent>
      );
      userEvent.hover(screen.getByText(/redacted/));
      expect(
        await screen.findByText(
          textWithMarkupMatcher(
            "Replaced because of a data scrubbing rule in your project's settings"
          ) // Fall back case
        )
      ).toBeInTheDocument(); // tooltip description
    });
  });
});
