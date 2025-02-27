import {OrganizationFixture} from 'sentry-fixture/organization';
import {SecretFixture} from 'sentry-fixture/secret';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {
  render,
  renderGlobalModal,
  screen,
  userEvent,
  waitForElementToBeRemoved,
} from 'sentry-test/reactTestingLibrary';

import * as indicators from 'sentry/actionCreators/indicator';
import OrganizationsStore from 'sentry/stores/organizationsStore';
import {
  OrganizationFeatureFlagsIndex,
  type Secret,
} from 'sentry/views/settings/featureFlags';

describe('OrganizationFeatureFlagsIndex', function () {
  const SECRETS_ENDPOINT = '/organizations/org-slug/flags/signing-secrets/';
  const LOGS_ENDPOINT = '/organizations/org-slug/flags/logs/';
  const {organization} = initializeOrg();

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

  it('shows secrets', async function () {
    const secrets: Secret[] = [
      SecretFixture(),
      SecretFixture({id: 2, provider: 'openfeature', secret: '456def****'}),
    ];

    const mock = MockApiClient.addMockResponse({
      url: SECRETS_ENDPOINT,
      method: 'GET',
      body: {data: secrets},
    });
    MockApiClient.addMockResponse({
      url: LOGS_ENDPOINT,
      method: 'GET',
      body: {data: []},
    });

    render(<OrganizationFeatureFlagsIndex />);

    await waitForElementToBeRemoved(() => screen.queryByTestId('loading-indicator'));

    expect(screen.getByText('launchdarkly')).toBeInTheDocument();
    expect(screen.getByText('openfeature')).toBeInTheDocument();

    expect(screen.queryByTestId('loading-error')).not.toBeInTheDocument();
    expect(screen.queryByTestId('loading-indicator')).not.toBeInTheDocument();
    expect(screen.queryByTestId('empty-state')).not.toBeInTheDocument();

    expect(mock).toHaveBeenCalledTimes(1);
    expect(mock).toHaveBeenCalledWith(
      SECRETS_ENDPOINT,
      expect.objectContaining({method: 'GET'})
    );
  });

  it('handle error when loading secrets', async function () {
    const mock = MockApiClient.addMockResponse({
      url: SECRETS_ENDPOINT,
      method: 'GET',
      statusCode: 400,
    });
    MockApiClient.addMockResponse({
      url: LOGS_ENDPOINT,
      method: 'GET',
      body: {data: []},
    });

    render(<OrganizationFeatureFlagsIndex />);

    expect(await screen.findByTestId('loading-error')).toHaveTextContent(
      'Failed to load secrets and providers for the organization.'
    );
    expect(screen.queryByTestId('loading-indicator')).not.toBeInTheDocument();
    expect(screen.queryByTestId('empty-state')).not.toBeInTheDocument();

    expect(mock).toHaveBeenCalledTimes(1);
  });

  it('shows empty state', async function () {
    const secrets: Secret[] = [];

    MockApiClient.addMockResponse({
      url: SECRETS_ENDPOINT,
      method: 'GET',
      body: {data: secrets},
    });
    MockApiClient.addMockResponse({
      url: LOGS_ENDPOINT,
      method: 'GET',
      body: {data: []},
    });

    render(<OrganizationFeatureFlagsIndex />);

    await waitForElementToBeRemoved(() => screen.queryByTestId('loading-indicator'));

    expect(screen.getByTestId('empty-state')).toBeInTheDocument();
    expect(screen.queryByTestId('loading-error')).not.toBeInTheDocument();
    expect(screen.queryByTestId('loading-indicator')).not.toBeInTheDocument();
  });

  describe('removing', function () {
    it('allows to remove secrets', async function () {
      jest.spyOn(indicators, 'addSuccessMessage');

      const secrets: Secret[] = [
        SecretFixture(),
        SecretFixture({id: 2, provider: 'openfeature', secret: '456def****'}),
      ];

      MockApiClient.addMockResponse({
        url: SECRETS_ENDPOINT,
        method: 'GET',
        body: {data: secrets},
      });
      MockApiClient.addMockResponse({
        url: LOGS_ENDPOINT,
        method: 'GET',
        body: {data: []},
      });

      const deleteMock = MockApiClient.addMockResponse({
        url: `${SECRETS_ENDPOINT}1/`,
        method: 'DELETE',
      });

      render(<OrganizationFeatureFlagsIndex />);
      renderGlobalModal();

      expect(await screen.findByText('openfeature')).toBeInTheDocument();
      expect(screen.getByText('launchdarkly')).toBeInTheDocument();

      expect(
        screen.getByLabelText('Remove secret for launchdarkly provider')
      ).toBeEnabled();

      await userEvent.click(
        screen.getByLabelText('Remove secret for launchdarkly provider')
      );
      // Confirm modal
      await userEvent.click(screen.getByRole('button', {name: 'Confirm'}));

      expect(screen.getByText('openfeature')).toBeInTheDocument();
      expect(screen.queryByText('launchdarkly')).not.toBeInTheDocument();

      expect(indicators.addSuccessMessage).toHaveBeenCalledWith(
        'Removed the provider and signing secret for the organization.'
      );

      expect(deleteMock).toHaveBeenCalledTimes(1);
    });
    it('does not allow to remove without permission', async function () {
      const org = OrganizationFixture({
        access: ['org:integrations'],
      });

      const secrets: Secret[] = [
        SecretFixture(),
        SecretFixture({
          id: 2,
          provider: 'openfeature',
          secret: '456def**************************',
        }),
      ];

      MockApiClient.addMockResponse({
        url: SECRETS_ENDPOINT,
        method: 'GET',
        body: {data: secrets},
      });
      MockApiClient.addMockResponse({
        url: LOGS_ENDPOINT,
        method: 'GET',
        body: {data: []},
      });

      render(<OrganizationFeatureFlagsIndex />, {organization: org});

      expect(await screen.findByText('launchdarkly')).toBeInTheDocument();

      expect(
        screen.getByLabelText('Remove secret for launchdarkly provider')
      ).toBeDisabled();
    });
  });
});
