import {SecretFixture} from 'sentry-fixture/secret';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import * as indicators from 'sentry/actionCreators/indicator';
import OrganizationsStore from 'sentry/stores/organizationsStore';
import OrganizationFeatureFlagsNewSecet from 'sentry/views/settings/featureFlags/organizationFeatureFlagsNewSecret';

describe('OrganizationFeatureFlagsNewSecret', function () {
  const ENDPOINT = '/organizations/org-slug/flags/signing-secrets/';
  const {organization, router} = initializeOrg();

  const defaultProps = {
    organization,
    router,
    location: router.location,
    params: {orgId: organization.slug},
    routes: router.routes,
    route: {},
    routeParams: router.params,
  };

  beforeEach(function () {
    OrganizationsStore.addOrReplace(organization);
  });

  afterEach(function () {
    MockApiClient.clearMockResponses();
  });

  it('can create secret', async function () {
    render(<OrganizationFeatureFlagsNewSecet {...defaultProps} />);

    const mock = MockApiClient.addMockResponse({
      url: ENDPOINT,
      method: 'POST',
    });

    await userEvent.type(screen.getByLabelText('Secret'), SecretFixture().secret);
    await userEvent.click(screen.getByRole('button', {name: 'Add Provider'}));

    expect(screen.getByLabelText('Secret')).toHaveValue(SecretFixture().secret);

    expect(mock).toHaveBeenCalledWith(
      ENDPOINT,
      expect.objectContaining({
        secret: SecretFixture().secret,
      })
    );
  });

  it('handles API errors when creating secret', async function () {
    jest.spyOn(indicators, 'addErrorMessage');

    render(<OrganizationFeatureFlagsNewSecet {...defaultProps} />);

    const mock = MockApiClient.addMockResponse({
      url: ENDPOINT,
      method: 'POST',
      body: {
        detail: 'Test API error occurred.',
      },
      statusCode: 400,
    });

    await userEvent.type(screen.getByLabelText('Secret'), '132456');
    await userEvent.click(screen.getByRole('button', {name: 'Add Provider'}));

    expect(indicators.addErrorMessage).toHaveBeenCalledWith(
      'Failed to add provider or secret.'
    );

    expect(mock).toHaveBeenCalledWith(
      ENDPOINT,
      expect.objectContaining({
        secret: '132456',
      })
    );
  });
});
