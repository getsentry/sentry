import {SecretFixture} from 'sentry-fixture/secret';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import OrganizationsStore from 'sentry/stores/organizationsStore';
import OrganizationFeatureFlagsNewSecret from 'sentry/views/settings/featureFlags/changeTracking/organizationFeatureFlagsNewSecret';

describe('OrganizationFeatureFlagsNewSecret', () => {
  const ENDPOINT = '/organizations/org-slug/flags/signing-secrets/';
  const {organization} = initializeOrg();

  beforeEach(() => {
    OrganizationsStore.addOrReplace(organization);
  });

  afterEach(() => {
    MockApiClient.clearMockResponses();
  });

  it('can create secret', async () => {
    // Mock the GET request for existing secrets
    MockApiClient.addMockResponse({
      url: ENDPOINT,
      method: 'GET',
      body: {data: []},
    });

    render(<OrganizationFeatureFlagsNewSecret />);

    const mock = MockApiClient.addMockResponse({
      url: ENDPOINT,
      method: 'POST',
    });

    await userEvent.type(screen.getByLabelText('Secret'), SecretFixture().secret);
    const providerDropdown = screen.getByRole('textbox', {
      name: 'Provider',
    });
    await userEvent.click(providerDropdown);
    await userEvent.click(screen.getByRole('menuitemradio', {name: 'LaunchDarkly'}));
    await userEvent.click(screen.getByRole('button', {name: 'Add Provider'}));

    expect(screen.getByRole('textbox', {name: 'Secret'})).toHaveValue(
      SecretFixture().secret
    );

    expect(mock).toHaveBeenCalledWith(
      ENDPOINT,
      expect.objectContaining({
        data: {
          provider: 'launchdarkly',
          secret: SecretFixture().secret,
        },
      })
    );
  });

  it('handles API errors when creating secret', async () => {
    // Mock the GET request for existing secrets
    MockApiClient.addMockResponse({
      url: ENDPOINT,
      method: 'GET',
      body: {data: []},
    });

    render(<OrganizationFeatureFlagsNewSecret />);

    const mock = MockApiClient.addMockResponse({
      url: ENDPOINT,
      method: 'POST',
      body: 'Test API error occurred.',
      statusCode: 403,
    });

    await userEvent.type(screen.getByLabelText('Secret'), SecretFixture().secret);
    const providerDropdown = screen.getByRole('textbox', {
      name: 'Provider',
    });
    await userEvent.click(providerDropdown);
    await userEvent.click(screen.getByRole('menuitemradio', {name: 'LaunchDarkly'}));
    await userEvent.click(screen.getByRole('button', {name: 'Add Provider'}));

    // Check that the error is displayed in an Alert component
    expect(await screen.findByText('Test API error occurred.')).toBeInTheDocument();

    expect(mock).toHaveBeenCalledWith(
      ENDPOINT,
      expect.objectContaining({
        data: {
          provider: 'launchdarkly',
          secret: SecretFixture().secret,
        },
      })
    );
  });
});
