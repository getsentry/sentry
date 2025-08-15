import {DocIntegrationFixture} from 'sentry-fixture/docIntegration';
import {
  BitbucketIntegrationConfigFixture,
  OrgOwnedAppsFixture,
  PluginListConfigFixture,
  ProviderListFixture,
  PublishedAppsFixture,
  SentryAppInstallsFixture,
} from 'sentry-fixture/integrationListDirectory';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import IntegrationListDirectory from 'sentry/views/settings/organizationIntegrations/integrationListDirectory';

const mockResponse = (mocks: Array<[string, unknown]>) => {
  mocks.forEach(([url, body]) => MockApiClient.addMockResponse({url, body}));
};

describe('IntegrationListDirectory', () => {
  beforeEach(() => {
    MockApiClient.clearMockResponses();
  });

  const organization = OrganizationFixture();

  describe('Renders view', () => {
    beforeEach(() => {
      mockResponse([
        [
          `/organizations/${organization.slug}/config/integrations/`,
          ProviderListFixture(),
        ],
        [
          `/organizations/${organization.slug}/integrations/`,
          [BitbucketIntegrationConfigFixture()],
        ],
        [`/organizations/${organization.slug}/sentry-apps/`, OrgOwnedAppsFixture()],
        ['/sentry-apps/', PublishedAppsFixture()],
        ['/doc-integrations/', [DocIntegrationFixture()]],
        [
          `/organizations/${organization.slug}/sentry-app-installations/`,
          SentryAppInstallsFixture(),
        ],
        [
          `/organizations/${organization.slug}/plugins/configs/`,
          PluginListConfigFixture(),
        ],
      ]);
    });

    it('shows installed integrations at the top in order of weight', async () => {
      render(<IntegrationListDirectory />, {
        organization,
      });
      expect(await screen.findByTestId('loading-indicator')).not.toBeInTheDocument();

      expect(await screen.findByRole('textbox', {name: 'Filter'})).toBeInTheDocument();

      [
        'bitbucket',
        'pagerduty',
        'my-headband-washer-289499',
        'sample-doc',
        'clickup',
        'amazon-sqs',
        'la-croix-monitor',
      ].map(testId => expect(screen.getByTestId(testId)).toBeInTheDocument());
    });

    it('does not show legacy plugin that has a First Party Integration if not installed', async () => {
      render(<IntegrationListDirectory />, {
        organization,
      });
      expect(await screen.findByTestId('loading-indicator')).not.toBeInTheDocument();

      expect(await screen.findByRole('textbox', {name: 'Filter'})).toBeInTheDocument();
      expect(screen.queryByText('GitHub (Legacy)')).not.toBeInTheDocument();
    });

    it('shows legacy plugin that has a First Party Integration if installed', async () => {
      render(<IntegrationListDirectory />, {
        organization,
      });
      expect(await screen.findByTestId('loading-indicator')).not.toBeInTheDocument();

      expect(await screen.findByText('PagerDuty (Legacy)')).toBeInTheDocument();
    });

    it('shows integrations that match the search query', async () => {
      render(<IntegrationListDirectory />, {organization});
      expect(await screen.findByTestId('loading-indicator')).not.toBeInTheDocument();

      expect(screen.getByText('PagerDuty (Legacy)')).toBeInTheDocument();

      await userEvent.type(screen.getByRole('textbox', {name: 'Filter'}), 'it');
      await userEvent.keyboard('{enter}');

      expect(screen.queryByText('PagerDuty (Legacy)')).not.toBeInTheDocument();
      expect(screen.getByText('Bitbucket')).toBeInTheDocument();
      expect(screen.getByText('La Croix Monitor')).toBeInTheDocument();
    });
  });
});
