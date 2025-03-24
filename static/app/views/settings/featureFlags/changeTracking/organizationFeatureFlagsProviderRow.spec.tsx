import {SecretFixture} from 'sentry-fixture/secret';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {
  render,
  renderGlobalModal,
  screen,
  userEvent,
} from 'sentry-test/reactTestingLibrary';

import OrganizationsStore from 'sentry/stores/organizationsStore';
import type {Secret} from 'sentry/views/settings/featureFlags/changeTracking';
import {OrganizationFeatureFlagsProviderRow} from 'sentry/views/settings/featureFlags/changeTracking/organizationFeatureFlagsProviderRow';

describe('OrganizationFeatureFlagsProviderRow', function () {
  const {organization, router} = initializeOrg();

  const removeSecret = jest.fn();

  const secret: Secret = SecretFixture();

  const defaultProps = {
    organization,
    isRemoving: false,
    secret,
    removeSecret,
    router,
    location: router.location,
    params: {orgId: organization.slug},
    routes: router.routes,
    route: {},
    routeParams: router.params,
  };

  beforeEach(function () {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/users/1234/',
      body: {},
    });
    OrganizationsStore.addOrReplace(organization);
  });

  afterEach(function () {
    MockApiClient.clearMockResponses();
  });

  it('shows secret and provider name', function () {
    render(<OrganizationFeatureFlagsProviderRow {...defaultProps} />);

    expect(screen.getByLabelText('Secret preview')).toHaveTextContent('123abc*****');
    expect(screen.getByText('launchdarkly')).toBeInTheDocument();
  });

  describe('removing', function () {
    it('does not allow to remove without access', function () {
      const props = {
        ...defaultProps,
        removeSecret: undefined,
      };

      render(<OrganizationFeatureFlagsProviderRow {...props} />);

      expect(
        screen.getByRole('button', {name: 'Remove secret for launchdarkly provider'})
      ).toBeDisabled();
    });

    it('allows to remove', async function () {
      render(<OrganizationFeatureFlagsProviderRow {...defaultProps} />);
      renderGlobalModal();

      expect(
        screen.getByRole('button', {name: 'Remove secret for launchdarkly provider'})
      ).toBeEnabled();

      await userEvent.click(
        screen.getByRole('button', {name: 'Remove secret for launchdarkly provider'})
      );
      // Confirm modal
      await userEvent.click(screen.getByRole('button', {name: 'Confirm'}));

      expect(removeSecret).toHaveBeenCalledWith(1); // the id of the secret
    });

    it('does not allow to remove while removing in progress', function () {
      const props = {
        ...defaultProps,
        isRemoving: true,
      };

      render(<OrganizationFeatureFlagsProviderRow {...props} />);

      expect(
        screen.getByRole('button', {name: 'Remove secret for launchdarkly provider'})
      ).toBeDisabled();
    });
  });
});
