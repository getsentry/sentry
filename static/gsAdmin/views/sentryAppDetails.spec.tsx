import {SentryAppFixture} from 'sentry-fixture/sentryApp';

import {render, screen} from 'sentry-test/reactTestingLibrary';

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
});
