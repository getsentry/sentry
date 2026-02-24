import {GitHubIntegrationProviderFixture} from 'sentry-fixture/githubIntegrationProvider';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import PreventPage from 'sentry/views/prevent';

describe('PreventPage', () => {
  const initialRouterConfig = {
    location: {
      pathname: '/prevent/',
    },
    route: '/prevent/',
    children: [{index: true, element: <p>Test content</p>}],
  };

  beforeEach(() => {
    MockApiClient.addMockResponse({
      url: `/organizations/org-slug/config/integrations/`,
      method: 'GET',
      body: {
        providers: [GitHubIntegrationProviderFixture()],
      },
    });
  });

  it('renders the passed children', () => {
    render(<PreventPage />, {
      initialRouterConfig,
    });

    const testContent = screen.getByText('Test content');
    expect(testContent).toBeInTheDocument();
  });
});
