import {render, screen, waitFor} from 'sentry-test/reactTestingLibrary';

import * as indicators from 'sentry/actionCreators/indicator';

import {GitHubInstallationCallout} from './gitHubInstallationCallout';

const INSTALLATION_ID = '123';
const INSTALLATION_URL = `/extensions/github/installation/${INSTALLATION_ID}/`;

describe('GitHubInstallationCallout', () => {
  beforeEach(() => {
    MockApiClient.clearMockResponses();
  });

  it('renders the info callout when the installation lookup succeeds', async () => {
    MockApiClient.addMockResponse({
      url: INSTALLATION_URL,
      body: {
        account: {login: 'acme-corp', type: 'Organization'},
        sender: {id: 42, login: 'octocat'},
      },
    });

    render(<GitHubInstallationCallout installationId={INSTALLATION_ID} />);

    expect(await screen.findByText(/has installed GitHub app to/)).toBeInTheDocument();
    expect(screen.getByRole('link', {name: 'octocat'})).toHaveAttribute(
      'href',
      'https://github.com/octocat'
    );
    expect(screen.getByRole('link', {name: 'acme-corp'})).toHaveAttribute(
      'href',
      'https://github.com/acme-corp'
    );
    expect(screen.getByText('Organization')).toBeInTheDocument();
  });

  it('renders the warning callout and surfaces an error toast when the lookup fails', async () => {
    const errorSpy = jest.spyOn(indicators, 'addErrorMessage');
    MockApiClient.addMockResponse({
      url: INSTALLATION_URL,
      statusCode: 500,
    });

    render(<GitHubInstallationCallout installationId={INSTALLATION_ID} />);

    expect(
      await screen.findByText(
        'We could not verify the authenticity of the installation request. We recommend restarting the installation process.'
      )
    ).toBeInTheDocument();
    await waitFor(() => {
      expect(errorSpy).toHaveBeenCalledWith(
        'Failed to retrieve GitHub installation details'
      );
    });
  });
});
