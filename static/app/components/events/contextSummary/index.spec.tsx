import {Event as EventFixture} from 'sentry-fixture/event';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';
import {textWithMarkupMatcher} from 'sentry-test/utils';

import ContextSummary from 'sentry/components/events/contextSummary';
import {ContextSummaryGPU} from 'sentry/components/events/contextSummary/contextSummaryGPU';
import {ContextSummaryOS} from 'sentry/components/events/contextSummary/contextSummaryOS';
import {ContextSummaryUser} from 'sentry/components/events/contextSummary/contextSummaryUser';
import {FILTER_MASK} from 'sentry/constants';

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

describe('ContextSummary', function () {
  describe('render()', function () {
    it('renders nothing without contexts', function () {
      const event = EventFixture({
        id: '',
        contexts: {},
      });

      render(<ContextSummary event={event} />);
    });

    it('renders nothing with a single user context', function () {
      const event = EventFixture({
        id: '',
        user: CONTEXT_USER,
        contexts: {},
      });

      render(<ContextSummary event={event} />);
    });

    it('should bail out with empty contexts', function () {
      const event = EventFixture({
        id: '',
        user: CONTEXT_USER,
        contexts: {
          device: {},
          os: {},
        },
      });

      render(<ContextSummary event={event} />);
    });

    it('renders at least three contexts', function () {
      const event = EventFixture({
        id: '',
        user: CONTEXT_USER,
        contexts: {
          device: CONTEXT_DEVICE,
        },
      });

      render(<ContextSummary event={event} />);
    });

    it('renders up to four contexts', function () {
      const event = EventFixture({
        id: '',
        user: CONTEXT_USER,
        contexts: {
          os: CONTEXT_OS,
          browser: CONTEXT_BROWSER,
          runtime: CONTEXT_RUNTIME,
          device: CONTEXT_DEVICE, // must be omitted
        },
      });

      render(<ContextSummary event={event} />);
    });

    it('should prefer client_os over os', function () {
      const event = EventFixture({
        id: '',
        user: CONTEXT_USER,
        contexts: {
          client_os: CONTEXT_OS,
          os: CONTEXT_OS_SERVER,
          browser: CONTEXT_BROWSER,
          runtime: CONTEXT_RUNTIME,
        },
      });

      render(<ContextSummary event={event} />);
    });

    it('renders client_os too', function () {
      const event = EventFixture({
        id: '',
        user: CONTEXT_USER,
        contexts: {
          client_os: CONTEXT_OS,
          browser: CONTEXT_BROWSER,
          runtime: CONTEXT_RUNTIME,
        },
      });

      render(<ContextSummary event={event} />);
    });

    it('should skip non-default named contexts', function () {
      const event = EventFixture({
        id: '',
        user: CONTEXT_USER,
        contexts: {
          os: CONTEXT_OS,
          chrome: CONTEXT_BROWSER, // non-standard context
          runtime: CONTEXT_RUNTIME,
          device: CONTEXT_DEVICE,
        },
      });

      render(<ContextSummary event={event} />);
    });

    it('should skip a missing user context', function () {
      const event = EventFixture({
        id: '',
        contexts: {
          os: CONTEXT_OS,
          chrome: CONTEXT_BROWSER, // non-standard context
          runtime: CONTEXT_RUNTIME,
          device: CONTEXT_DEVICE,
        },
      });

      render(<ContextSummary event={event} />);
    });
  });
});

describe('OsSummary', function () {
  describe('render()', function () {
    it('renders the version string', function () {
      render(
        <ContextSummaryOS
          data={{
            kernel_version: '17.5.0',
            version: '10.13.4',
            name: 'Mac OS X',
          }}
          meta={{}}
        />
      );
    });

    it('renders the kernel version when no version', function () {
      render(
        <ContextSummaryOS
          data={{
            kernel_version: '17.5.0',
            name: 'Mac OS X',
          }}
          meta={{}}
        />
      );
    });

    it('renders unknown when no version', function () {
      render(
        <ContextSummaryOS
          data={{
            name: 'Mac OS X',
          }}
          meta={{}}
        />
      );
    });

    it('display redacted name', async function () {
      render(
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
      );
      await userEvent.hover(screen.getByText(/redacted/));
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
      );
      await userEvent.hover(screen.getByText(/redacted/));
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
      render(
        <ContextSummaryGPU
          data={{
            name: 'Mali-T880',
            vendor_name: 'ARM',
          }}
          meta={{}}
        />
      );
    });

    it('renders unknown when no vendor', function () {
      render(
        <ContextSummaryGPU
          data={{
            name: 'Apple A8 GPU',
          }}
          meta={{}}
        />
      );
    });

    it('display redacted name', async function () {
      render(
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
      );
      await userEvent.hover(screen.getByText(/redacted/));
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

      const {rerender} = render(<ContextSummaryUser data={user1} meta={{}} />);
      expect(screen.getByText(user1.email)).toBeInTheDocument();

      const user2 = {
        ip_address: '12.31.20.12',
        id: '26',
        username: 'maiseythedog',
        name: 'Maisey Dog',
      };

      rerender(<ContextSummaryUser data={user2} meta={{}} />);
      expect(screen.getByTestId('user-title')?.textContent).toEqual(user2.ip_address);

      const user3 = {
        id: '26',
        username: 'maiseythedog',
        name: 'Maisey Dog',
      };

      rerender(
        <ContextSummaryUser
          data={{
            id: '26',
            username: 'maiseythedog',
            name: 'Maisey Dog',
          }}
          meta={{}}
        />
      );
      expect(screen.getByTestId('user-title')?.textContent).toEqual(user3.id);

      const user4 = {
        username: 'maiseythedog',
        name: 'Maisey Dog',
      };

      rerender(<ContextSummaryUser data={user4} meta={{}} />);
      expect(screen.getByTestId('user-title')).toHaveTextContent(user4.username);
    });

    it('renders NoSummary if no email, IP, id, or username', function () {
      render(
        <ContextSummaryUser
          data={{
            name: 'Maisey Dog',
          }}
          meta={{}}
        />
      );
      expect(screen.queryByTestId('user-title')).not.toBeInTheDocument();
      expect(screen.getByTestId('no-summary-title')).toHaveTextContent('Unknown User');
    });

    it('does not use filtered values for title', function () {
      const {rerender} = render(
        <ContextSummaryUser
          data={{
            email: FILTER_MASK,
          }}
          meta={{}}
        />
      );
      expect(screen.queryByTestId('user-title')).not.toBeInTheDocument();
      expect(screen.getByTestId('no-summary-title')).toHaveTextContent('Unknown User');

      // TODO: currently, the IP filter just eliminates IP addresses rather than
      // filtering them like other user data, so here, where you'd expect a filtered
      // IP address, there isn't one. Add a similar entry to the above and below
      // if/when that changes.

      rerender(
        <ContextSummaryUser
          data={{
            id: FILTER_MASK,
          }}
          meta={{}}
        />
      );
      expect(screen.queryByTestId('user-title')).not.toBeInTheDocument();
      expect(screen.getByTestId('no-summary-title')).toHaveTextContent('Unknown User');

      rerender(
        <ContextSummaryUser
          data={{
            username: FILTER_MASK,
          }}
          meta={{}}
        />
      );
      expect(screen.queryByTestId('user-title')).not.toBeInTheDocument();
      expect(screen.getByTestId('no-summary-title')).toHaveTextContent('Unknown User');
    });

    it('does not use filtered values for avatar', function () {
      // id is never used for avatar purposes, but is enough to keep us from
      // ending up with a NoSummary component where the UserSummary component
      // should be

      const {rerender} = render(
        <ContextSummaryUser
          data={{
            id: '26',
            name: FILTER_MASK,
          }}
          meta={{}}
        />
      );
      expect(screen.getByText('?')).toBeInTheDocument();

      rerender(
        <ContextSummaryUser
          data={{
            id: '26',
            email: FILTER_MASK,
          }}
          meta={{}}
        />
      );
      expect(screen.getByText('?')).toBeInTheDocument();

      rerender(
        <ContextSummaryUser
          data={{
            id: '26',
            username: FILTER_MASK,
          }}
          meta={{}}
        />
      );
      expect(screen.getByText('?')).toBeInTheDocument();
    });

    it('display redacted email', async function () {
      render(
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
      );
      await userEvent.hover(screen.getByText(/redacted/));
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
