import {OrganizationFixture} from 'sentry-fixture/organization';
import {SecretFixture} from 'sentry-fixture/secret';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {
  render,
  renderGlobalModal,
  screen,
  userEvent,
  within,
} from 'sentry-test/reactTestingLibrary';

import * as indicators from 'sentry/actionCreators/indicator';
import OrganizationsStore from 'sentry/stores/organizationsStore';
import OrganizationFeatureFlagsChangeTracking, {
  type Secret,
} from 'sentry/views/settings/featureFlags/changeTracking';

describe('OrganizationFeatureFlagsIndex', () => {
  const SECRETS_ENDPOINT = '/organizations/org-slug/flags/signing-secrets/';
  const LOGS_ENDPOINT = '/organizations/org-slug/flags/logs/';
  const {organization} = initializeOrg();

  beforeEach(() => {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/users/1234/',
      body: {},
    });
    MockApiClient.addMockResponse({
      url: LOGS_ENDPOINT,
      method: 'GET',
      body: {data: []},
    });
    OrganizationsStore.addOrReplace(organization);
  });

  afterEach(() => {
    MockApiClient.clearMockResponses();
  });

  it('shows secrets', async () => {
    const secrets: Secret[] = [
      SecretFixture(),
      SecretFixture({id: 2, provider: 'openfeature', secret: '456def****'}),
    ];

    const mock = MockApiClient.addMockResponse({
      url: SECRETS_ENDPOINT,
      method: 'GET',
      body: {data: secrets},
    });

    render(<OrganizationFeatureFlagsChangeTracking />);

    const secretsTable = within(screen.getByTestId('secrets-table'));

    expect(await secretsTable.findByText('launchdarkly')).toBeInTheDocument();
    expect(await secretsTable.findByText('openfeature')).toBeInTheDocument();

    expect(secretsTable.queryByTestId('loading-error')).not.toBeInTheDocument();
    expect(secretsTable.queryByTestId('loading-indicator')).not.toBeInTheDocument();
    expect(secretsTable.queryByTestId('empty-state')).not.toBeInTheDocument();

    expect(mock).toHaveBeenCalledTimes(1);
    expect(mock).toHaveBeenCalledWith(
      SECRETS_ENDPOINT,
      expect.objectContaining({method: 'GET'})
    );
  });

  it('handle error when loading secrets', async () => {
    const mock = MockApiClient.addMockResponse({
      url: SECRETS_ENDPOINT,
      method: 'GET',
      statusCode: 400,
    });

    render(<OrganizationFeatureFlagsChangeTracking />);

    const secretsTable = within(screen.getByTestId('secrets-table'));

    expect(await secretsTable.findByTestId('loading-error')).toHaveTextContent(
      'Failed to load secrets and providers for the organization.'
    );
    expect(secretsTable.queryByTestId('loading-indicator')).not.toBeInTheDocument();
    expect(secretsTable.queryByTestId('empty-state')).not.toBeInTheDocument();

    expect(mock).toHaveBeenCalledTimes(1);
  });

  it('shows empty state', async () => {
    const secrets: Secret[] = [];

    MockApiClient.addMockResponse({
      url: SECRETS_ENDPOINT,
      method: 'GET',
      body: {data: secrets},
    });

    render(<OrganizationFeatureFlagsChangeTracking />);

    const secretsTable = within(screen.getByTestId('secrets-table'));

    expect(await secretsTable.findByTestId('empty-state')).toBeInTheDocument();
    expect(secretsTable.queryByTestId('loading-error')).not.toBeInTheDocument();
    expect(secretsTable.queryByTestId('loading-indicator')).not.toBeInTheDocument();
  });

  describe('removing', () => {
    it('allows to remove secrets', async () => {
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

      const deleteMock = MockApiClient.addMockResponse({
        url: `${SECRETS_ENDPOINT}1/`,
        method: 'DELETE',
      });

      render(<OrganizationFeatureFlagsChangeTracking />);
      renderGlobalModal();

      const secretsTable = within(screen.getByTestId('secrets-table'));

      expect(await secretsTable.findByText('openfeature')).toBeInTheDocument();
      expect(secretsTable.getByText('launchdarkly')).toBeInTheDocument();

      expect(
        secretsTable.getByLabelText('Remove secret for launchdarkly provider')
      ).toBeEnabled();

      await userEvent.click(
        secretsTable.getByLabelText('Remove secret for launchdarkly provider')
      );
      // Confirm modal
      await userEvent.click(screen.getByRole('button', {name: 'Confirm'}));

      expect(secretsTable.getByText('openfeature')).toBeInTheDocument();
      expect(secretsTable.queryByText('launchdarkly')).not.toBeInTheDocument();

      expect(indicators.addSuccessMessage).toHaveBeenCalledWith(
        'Removed the provider and signing secret for the organization.'
      );

      expect(deleteMock).toHaveBeenCalledTimes(1);
    });
    it('does not allow to remove without permission', async () => {
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

      render(<OrganizationFeatureFlagsChangeTracking />, {organization: org});

      const secretsTable = within(screen.getByTestId('secrets-table'));

      expect(await secretsTable.findByText('launchdarkly')).toBeInTheDocument();
      expect(
        secretsTable.getByLabelText('Remove secret for launchdarkly provider')
      ).toBeDisabled();
    });
  });
});
