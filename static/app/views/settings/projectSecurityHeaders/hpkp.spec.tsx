import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen} from 'sentry-test/reactTestingLibrary';

import ProjectHpkpReports from 'sentry/views/settings/projectSecurityHeaders/hpkp';

describe('ProjectHpkpReports', function () {
  const {organization, project} = initializeOrg();
  const keysUrl = `/projects/${organization.slug}/${project.slug}/keys/`;

  const initialRouterConfig = {
    location: {
      pathname: `/settings/${organization.slug}/projects/${project.slug}/settings/security-headers/hpkp/`,
    },
    route: '/settings/:orgId/projects/:projectId/settings/security-headers/hpkp/',
  };

  beforeEach(function () {
    MockApiClient.clearMockResponses();
    MockApiClient.addMockResponse({
      url: keysUrl,
      method: 'GET',
      body: [],
    });
  });

  it('renders', async function () {
    render(<ProjectHpkpReports />, {
      organization,
      initialRouterConfig,
    });

    // Heading
    expect(
      await screen.findByText('HTTP Public Key Pinning', {selector: 'h1'})
    ).toBeInTheDocument();
  });

  it('renders loading error', async function () {
    MockApiClient.addMockResponse({
      url: keysUrl,
      method: 'GET',
      statusCode: 400,
      body: {},
    });
    render(<ProjectHpkpReports />, {
      organization,
      initialRouterConfig,
    });

    expect(
      await screen.findByText('There was an error loading data.')
    ).toBeInTheDocument();
  });
});
