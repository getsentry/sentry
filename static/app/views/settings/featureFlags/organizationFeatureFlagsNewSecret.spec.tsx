import {SecretFixture} from 'sentry-fixture/secret';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import * as indicators from 'sentry/actionCreators/indicator';
import OrganizationsStore from 'sentry/stores/organizationsStore';
import OrganizationFeatureFlagsNewSecet from 'sentry/views/settings/featureFlags/organizationFeatureFlagsNewSecret';

describe('OrganizationFeatureFlagsNewSecret', function () {
  const ENDPOINT = '/organizations/org-slug/flags/signing-secrets/';
  const {organization} = initializeOrg();

  beforeEach(function () {
    OrganizationsStore.addOrReplace(organization);
  });

  afterEach(function () {
    MockApiClient.clearMockResponses();
  });

  it('can create secret', async function () {
    render(<OrganizationFeatureFlagsNewSecet />);

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

  it('handles API errors when creating secret', async function () {
    jest.spyOn(indicators, 'addErrorMessage');

    render(<OrganizationFeatureFlagsNewSecet />);

    const mock = MockApiClient.addMockResponse({
      url: ENDPOINT,
      method: 'POST',
      body: {
        detail: 'Test API error occurred.',
      },
      statusCode: 403,
    });

    await userEvent.type(screen.getByLabelText('Secret'), SecretFixture().secret);
    const providerDropdown = screen.getByRole('textbox', {
      name: 'Provider',
    });
    await userEvent.click(providerDropdown);
    await userEvent.click(screen.getByRole('menuitemradio', {name: 'LaunchDarkly'}));
    await userEvent.click(screen.getByRole('button', {name: 'Add Provider'}));

    expect(indicators.addErrorMessage).toHaveBeenCalledWith(
      'Failed to add provider or secret.'
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
});
