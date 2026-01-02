import {GitHubIntegrationProviderFixture} from 'sentry-fixture/githubIntegrationProvider';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import PreventPage from 'sentry/views/prevent';

const PREVENT_FEATURE = 'prevent-ai';

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

  describe('when the user has access to the feature', () => {
    it('renders the passed children', () => {
      render(<PreventPage />, {
        organization: OrganizationFixture({features: [PREVENT_FEATURE]}),
        initialRouterConfig,
      });

      const testContent = screen.getByText('Test content');
      expect(testContent).toBeInTheDocument();
    });
  });

  describe('when the user does not have access to the feature', () => {
    it('renders the NoAccess component', () => {
      render(<PreventPage />, {
        organization: OrganizationFixture({features: []}),
        initialRouterConfig,
      });

      const noAccessText = screen.getByText("You don't have access to this feature");
      expect(noAccessText).toBeInTheDocument();
    });
  });
});
