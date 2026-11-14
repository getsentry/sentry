import * as Sentry from '@sentry/react';

import {render, screen, within} from 'sentry-test/reactTestingLibrary';

import {Button} from '@sentry/scraps/button';

import {SeerMarkdown} from 'sentry/components/seer/markdown';
import * as constants from 'sentry/constants';
import {RouteConfigProvider} from 'sentry/router/routeConfigContext';
import {buildRoutes} from 'sentry/router/routes';
import {ConfigStore} from 'sentry/stores/configStore';

// Replace USING_CUSTOMER_DOMAIN with a getter so it can be toggled per test.
jest.mock('sentry/constants', () => {
  const originalModule = jest.requireActual('sentry/constants');

  return {
    __esModule: true,
    ...originalModule,
    get USING_CUSTOMER_DOMAIN() {
      return false;
    },
  };
});

jest.mock('sentry/components/charts/baseChart', () => ({
  BaseChart: jest.fn(() => null),
}));

const CHART = `{% chart %}${JSON.stringify({
  title: 'Error volume',
  visualization: 'line',
  x_axis: 'time',
  series: [
    {
      label: 'Errors',
      data: [
        {x: '2026-07-30T12:00:00Z', y: 12},
        {x: '2026-07-30T13:00:00Z', y: 18},
      ],
    },
  ],
})}{% /chart %}`;

function renderWithLeadingEmbedActions(raw: string) {
  const release = jest.fn();
  const onClaim = jest.fn(() => release);
  const result = render(
    <SeerMarkdown
      raw={raw}
      leadingEmbedActions={{actions: <Button>Block actions</Button>, onClaim}}
    />
  );
  return {...result, onClaim, release};
}

describe('SeerMarkdown', () => {
  it('drops unknown embed tags and reports them', () => {
    const captureException = jest.spyOn(Sentry, 'captureException');
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});

    const raw = 'Before {% unknown-embed %}{"id":"1"}{% /unknown-embed %} after';
    const {container} = render(<SeerMarkdown raw={raw} />);

    expect(container).toHaveTextContent(/Before/);
    expect(container).toHaveTextContent(/after/);
    expect(container).not.toHaveTextContent(/unknown-embed/);

    if (process.env.NODE_ENV === 'development') {
      expect(warn).toHaveBeenCalledWith(
        expect.stringContaining('[Markdown] no renderer for tag: unknown-embed'),
        expect.anything()
      );
      expect(captureException).not.toHaveBeenCalled();
    } else {
      expect(captureException).toHaveBeenCalledWith(
        expect.objectContaining({
          message: '[Markdown] no renderer for tag: unknown-embed',
        })
      );
    }

    captureException.mockRestore();
    warn.mockRestore();
  });

  describe('leadingEmbedActions', () => {
    it('puts them in the header of the embed the message opens with', () => {
      const {onClaim, release, unmount} = renderWithLeadingEmbedActions(
        `${CHART}\n\nErrors returned to baseline.`
      );

      expect(
        within(screen.getByTestId('seer-chart-embed')).getByRole('button', {
          name: 'Block actions',
        })
      ).toBeInTheDocument();
      expect(onClaim).toHaveBeenCalledTimes(1);

      unmount();
      expect(release).toHaveBeenCalledTimes(1);
    });

    it('keeps a single claim while the message streams in', () => {
      const release = jest.fn();
      const onClaim = jest.fn(() => release);
      const leadingEmbedActions = {actions: <Button>Block actions</Button>, onClaim};
      const {rerender} = render(
        <SeerMarkdown raw={CHART} leadingEmbedActions={leadingEmbedActions} />
      );

      rerender(
        <SeerMarkdown
          raw={`${CHART}\n\nErrors returned`}
          leadingEmbedActions={{...leadingEmbedActions}}
        />
      );

      expect(onClaim).toHaveBeenCalledTimes(1);
      expect(release).not.toHaveBeenCalled();
    });

    it('leaves them to the host when the message opens with prose', () => {
      const {onClaim} = renderWithLeadingEmbedActions(`Errors spiked.\n\n${CHART}`);

      expect(screen.getByTestId('seer-chart-embed')).toBeInTheDocument();
      expect(
        screen.queryByRole('button', {name: 'Block actions'})
      ).not.toBeInTheDocument();
      expect(onClaim).not.toHaveBeenCalled();
    });

    it('leaves them to the host when the opening embed has no card', () => {
      const {onClaim} = renderWithLeadingEmbedActions(
        '{% dsn %}{"value":"https://key@o0.ingest.sentry.io/0"}{% /dsn %}'
      );

      expect(
        screen.queryByRole('button', {name: 'Block actions'})
      ).not.toBeInTheDocument();
      expect(onClaim).not.toHaveBeenCalled();
    });
  });

  describe('internal links', () => {
    function renderWithRoutes(raw: string) {
      return render(
        <RouteConfigProvider value={buildRoutes()}>
          <SeerMarkdown raw={raw} />
        </RouteConfigProvider>
      );
    }

    describe('without customer domains', () => {
      it.each([
        '/organizations/acme/explore/logs/',
        '/organizations/acme/issues/',
        '/settings/acme/auth-tokens/',
        '/settings/acme/projects/my-proj/keys/',
        '/settings/account/api/auth-tokens/',
        '/organizations/acme/dashboards/new/?project=42',
        '/organizations/acme/issues/123/',
        '/organizations/acme/projects/my-proj/',
      ])('links %s in the current tab', path => {
        renderWithRoutes(`[Open](${path})`);

        const link = screen.getByRole('link', {name: 'Open'});
        expect(link).toHaveAttribute('href', path);
        expect(link).not.toHaveAttribute('target');
      });

      it.each([
        '/organizations/acme/not-a-real-page/foo/',
        '/organizations/acme/not-a-real-page/',
        '/not-a-real-page/foo/',
        '/not-a-real-page/',
        '/settings/acme/auth-token/',
      ])('renders %s as plain text', path => {
        renderWithRoutes(`See [the page](${path}) here`);

        expect(screen.queryByRole('link')).not.toBeInTheDocument();
        expect(screen.getByText(/the page/)).toBeInTheDocument();
      });

      it('strips the origin from same-origin absolute urls', () => {
        renderWithRoutes(
          `[Open](${window.location.origin}/organizations/acme/explore/logs/)`
        );

        expect(screen.getByRole('link', {name: 'Open'})).toHaveAttribute(
          'href',
          '/organizations/acme/explore/logs/'
        );
      });

      it('leaves external urls unchanged', () => {
        renderWithRoutes('[Docs](https://docs.sentry.io/product/)');

        const link = screen.getByRole('link', {name: 'Docs'});
        expect(link).toHaveAttribute('href', 'https://docs.sentry.io/product/');
        expect(link).toHaveAttribute('target', '_blank');
      });
    });

    describe('with customer domains', () => {
      let configState: ReturnType<typeof ConfigStore.getState>;

      beforeEach(() => {
        configState = ConfigStore.getState();
        ConfigStore.loadInitialData({
          ...configState,
          customerDomain: {
            subdomain: 'acme',
            organizationUrl: 'https://acme.sentry.io',
            sentryUrl: 'https://sentry.io',
          },
        });
        jest.spyOn(constants, 'USING_CUSTOMER_DOMAIN', 'get').mockReturnValue(true);
      });

      afterEach(() => {
        ConfigStore.loadInitialData(configState);
        jest.restoreAllMocks();
      });

      it.each([
        ['/organizations/acme/explore/logs/', '/explore/logs/'],
        ['/settings/acme/auth-tokens/', '/settings/auth-tokens/'],
        ['/settings/acme/projects/my-proj/keys/', '/settings/projects/my-proj/keys/'],
        ['/settings/account/api/auth-tokens/', '/settings/account/api/auth-tokens/'],
        ['/organizations/acme/dashboards/new/?project=42', '/dashboards/new/?project=42'],
        ['/organizations/acme/issues/123/', '/issues/123/'],
        ['/organizations/acme/projects/my-proj/', '/projects/my-proj/'],
      ])('links %s as %s', (path, expected) => {
        renderWithRoutes(`[Open](${path})`);

        const link = screen.getByRole('link', {name: 'Open'});
        expect(link).toHaveAttribute('href', expected);
        expect(link).not.toHaveAttribute('target');
      });

      it.each([
        '/organizations/acme/not-a-real-page/foo/',
        '/organizations/acme/not-a-real-page/',
        '/settings/acme/auth-token/',
      ])('renders %s as plain text', path => {
        renderWithRoutes(`See [the page](${path}) here`);

        expect(screen.queryByRole('link')).not.toBeInTheDocument();
        expect(screen.getByText(/the page/)).toBeInTheDocument();
      });
    });
  });
});
