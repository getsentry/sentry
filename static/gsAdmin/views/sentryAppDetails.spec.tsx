import {SentryAppFixture} from 'sentry-fixture/sentryApp';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {SentryAppDetails} from 'admin/views/sentryAppDetails';

describe('SentryAppDetails', () => {
  beforeEach(() => {
    MockApiClient.clearMockResponses();
  });

  it('renders an unpublished app without crashing', async () => {
    const sentryApp = {
      ...SentryAppFixture({
        slug: 'cursor-staging',
        status: 'unpublished',
      }),
      owner: {slug: 'cursor'},
    };

    MockApiClient.addMockResponse({
      url: `/sentry-apps/${sentryApp.slug}/`,
      method: 'GET',
      body: sentryApp,
    });

    render(<SentryAppDetails />, {
      initialRouterConfig: {
        location: {
          pathname: `/_admin/sentry-apps/${sentryApp.slug}/`,
        },
        route: '/_admin/sentry-apps/:sentryAppSlug/',
      },
    });

    expect(await screen.findByRole('heading', {name: 'Sentry Apps'})).toBeInTheDocument();
    expect(screen.getAllByText('unpublished')).not.toHaveLength(0);
  });

  it('shows disable action for a non-disabled app', async () => {
    const sentryApp = {
      ...SentryAppFixture({slug: 'test-app', status: 'unpublished'}),
      owner: {slug: 'test-org'},
      isDisabled: false,
    };

    MockApiClient.addMockResponse({
      url: `/sentry-apps/${sentryApp.slug}/`,
      method: 'GET',
      body: sentryApp,
    });

    render(<SentryAppDetails />, {
      initialRouterConfig: {
        location: {pathname: `/_admin/sentry-apps/${sentryApp.slug}/`},
        route: '/_admin/sentry-apps/:sentryAppSlug/',
      },
    });

    await userEvent.click(await screen.findByTestId('detail-actions'));
    expect(await screen.findByText('Disable App')).toBeInTheDocument();
    expect(screen.queryByText('disabled')).not.toBeInTheDocument();
  });

  it('shows enable action and disabled badge for a disabled app', async () => {
    const sentryApp = {
      ...SentryAppFixture({slug: 'test-app', status: 'unpublished'}),
      owner: {slug: 'test-org'},
      isDisabled: true,
    };

    MockApiClient.addMockResponse({
      url: `/sentry-apps/${sentryApp.slug}/`,
      method: 'GET',
      body: sentryApp,
    });

    render(<SentryAppDetails />, {
      initialRouterConfig: {
        location: {pathname: `/_admin/sentry-apps/${sentryApp.slug}/`},
        route: '/_admin/sentry-apps/:sentryAppSlug/',
      },
    });

    expect(await screen.findByText('disabled')).toBeInTheDocument();
    await userEvent.click(screen.getByTestId('detail-actions'));
    expect(await screen.findByText('Enable App')).toBeInTheDocument();
  });

  it('shows isDisabled detail label', async () => {
    const sentryApp = {
      ...SentryAppFixture({slug: 'test-app', status: 'unpublished'}),
      owner: {slug: 'test-org'},
      isDisabled: true,
    };

    MockApiClient.addMockResponse({
      url: `/sentry-apps/${sentryApp.slug}/`,
      method: 'GET',
      body: sentryApp,
    });

    render(<SentryAppDetails />, {
      initialRouterConfig: {
        location: {pathname: `/_admin/sentry-apps/${sentryApp.slug}/`},
        route: '/_admin/sentry-apps/:sentryAppSlug/',
      },
    });

    expect(await screen.findByText('isDisabled')).toBeInTheDocument();
  });
});
