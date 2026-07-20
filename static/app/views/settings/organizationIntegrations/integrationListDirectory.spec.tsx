import {DocIntegrationFixture} from 'sentry-fixture/docIntegration';
import {
  BitbucketIntegrationConfigFixture,
  OrgOwnedAppsFixture,
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
        [`/organizations/${organization.slug}/legacy-webhooks/`, {projects: []}],
      ]);
    });

    it('shows installed integrations at the top in order of weight', async () => {
      render(<IntegrationListDirectory />, {
        organization,
      });
      expect(await screen.findByRole('textbox', {name: 'Filter'})).toBeInTheDocument();

      [
        'bitbucket',
        'my-headband-washer-289499',
        'sample-doc',
        'clickup',
        'la-croix-monitor',
      ].map(testId => expect(screen.getByTestId(testId)).toBeInTheDocument());
    });

    it('shows integrations that match the search query', async () => {
      render(<IntegrationListDirectory />, {organization});
      expect(await screen.findByRole('textbox', {name: 'Filter'})).toBeInTheDocument();

      await userEvent.type(screen.getByRole('textbox', {name: 'Filter'}), 'it');
      await userEvent.keyboard('{enter}');

      expect(screen.getByText('Bitbucket')).toBeInTheDocument();
      expect(screen.getByText('La Croix Monitor')).toBeInTheDocument();
    });
  });

  describe('Legacy webhook entry', () => {
    const webhookOrg = OrganizationFixture();

    beforeEach(() => {
      mockResponse([
        [`/organizations/${webhookOrg.slug}/config/integrations/`, ProviderListFixture()],
        [
          `/organizations/${webhookOrg.slug}/integrations/`,
          [BitbucketIntegrationConfigFixture()],
        ],
        [`/organizations/${webhookOrg.slug}/sentry-apps/`, OrgOwnedAppsFixture()],
        ['/sentry-apps/', PublishedAppsFixture()],
        ['/doc-integrations/', [DocIntegrationFixture()]],
        [
          `/organizations/${webhookOrg.slug}/sentry-app-installations/`,
          SentryAppInstallsFixture(),
        ],
      ]);
    });

    it('shows webhook entry with projects configured', async () => {
      MockApiClient.addMockResponse({
        url: `/organizations/${webhookOrg.slug}/legacy-webhooks/`,
        body: {
          projects: [
            {
              projectId: 1,
              projectSlug: 'my-project',
              projectName: 'My Project',
              projectPlatform: 'javascript',
              enabled: true,
            },
          ],
        },
      });

      render(<IntegrationListDirectory />, {organization: webhookOrg});
      expect(await screen.findByText('Webhooks (Legacy)')).toBeInTheDocument();
      expect(screen.getByTestId('legacy-webhooks')).toBeInTheDocument();
    });
  });
});
