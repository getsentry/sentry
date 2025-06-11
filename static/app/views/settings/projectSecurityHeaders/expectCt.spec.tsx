import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen} from 'sentry-test/reactTestingLibrary';

import ProjectExpectCtReports from 'sentry/views/settings/projectSecurityHeaders/expectCt';

describe('ProjectExpectCtReports', function () {
  const {organization, project} = initializeOrg();
  const keysUrl = `/projects/${organization.slug}/${project.slug}/keys/`;

  const initialRouterConfig = {
    location: {
      pathname: `/settings/${organization.slug}/projects/${project.slug}/settings/security-headers/expect-ct/`,
    },
    route: '/settings/:orgId/projects/:projectId/settings/security-headers/expect-ct/',
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
    render(<ProjectExpectCtReports />, {
      organization,
      initialRouterConfig,
    });

    // Heading
    expect(
      await screen.findByText('Certificate Transparency', {selector: 'h1'})
    ).toBeInTheDocument();
  });

  it('renders loading error', async function () {
    MockApiClient.addMockResponse({
      url: keysUrl,
      method: 'GET',
      statusCode: 400,
      body: {},
    });
    render(<ProjectExpectCtReports />, {
      organization,
      initialRouterConfig,
    });

    expect(
      await screen.findByText('There was an error loading data.')
    ).toBeInTheDocument();
  });
});
