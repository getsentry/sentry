import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen} from 'sentry-test/reactTestingLibrary';

import ProjectHpkpReports from 'sentry/views/settings/projectSecurityHeaders/hpkp';

describe('ProjectHpkpReports', function () {
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
    render(<ProjectHpkpReports />, {
      organization,
    });

    // Renders the loading indication initially
    expect(screen.getByTestId('loading-indicator')).toBeInTheDocument();

    // Heading
    expect(
      await screen.findByText('HTTP Public Key Pinning', {selector: 'h4'})
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
    });

    expect(
      await screen.findByText('There was an error loading data.')
    ).toBeInTheDocument();
  });
});
