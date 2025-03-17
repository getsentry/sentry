import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen} from 'sentry-test/reactTestingLibrary';

import ProjectSecurityHeaders from 'sentry/views/settings/projectSecurityHeaders';

describe('ProjectSecurityHeaders', function () {
  const {organization, project} = initializeOrg();
  const keysUrl = `/projects/${organization.slug}/${project.slug}/keys/`;

  beforeEach(function () {
    MockApiClient.clearMockResponses();
    MockApiClient.addMockResponse({
      url: keysUrl,
      method: 'GET',
      body: [],
    });
  });

  it('renders', async function () {
    render(<ProjectSecurityHeaders />, {
      organization,
    });

    // Renders the loading indication initially
    expect(screen.getByTestId('loading-indicator')).toBeInTheDocument();

    // Heading
    expect(
      await screen.findByText('Security Header Reports', {selector: 'h1'})
    ).toBeInTheDocument();
  });

  it('renders loading error', async function () {
    MockApiClient.addMockResponse({
      url: keysUrl,
      method: 'GET',
      statusCode: 400,
      body: {},
    });
    render(<ProjectSecurityHeaders />, {
      organization,
    });

    expect(
      await screen.findByText('There was an error loading data.')
    ).toBeInTheDocument();
  });
});
