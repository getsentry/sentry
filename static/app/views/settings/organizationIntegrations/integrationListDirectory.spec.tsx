import {DocIntegrationFixture} from 'sentry-fixture/docIntegration';
import {
  BitbucketIntegrationConfigFixture,
  OrgOwnedAppsFixture,
  ProviderListFixture,
  PublishedAppsFixture,
  SentryAppInstallsFixture,
} from 'sentry-fixture/integrationListDirectory';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {SentryAppFixture} from 'sentry-fixture/sentryApp';

import {act, render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {trackAnalytics} from 'sentry/utils/analytics';
import IntegrationListDirectory from 'sentry/views/settings/organizationIntegrations/integrationListDirectory';

jest.mock('sentry/utils/analytics');

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

    it('loads all published app pages and includes later pages in search', async () => {
      const secondPageResponse = Promise.withResolvers<void>();
      const lastPageResponse = Promise.withResolvers<void>();
      const firstPage = MockApiClient.addMockResponse({
        url: '/sentry-apps/',
        match: [MockApiClient.matchQuery({status: 'published', cursor: undefined})],
        body: PublishedAppsFixture(),
        headers: {
          Link: '<https://sentry.io/api/0/sentry-apps/?cursor=100:1:0>; rel="next"; results="true"; cursor="100:1:0"',
        },
      });
      const secondPage = MockApiClient.addMockResponse({
        url: '/sentry-apps/',
        asyncDelay: secondPageResponse.promise,
        match: [MockApiClient.matchQuery({status: 'published', cursor: '100:1:0'})],
        body: [SentryAppFixture({name: 'Split', slug: 'split', status: 'published'})],
        headers: {
          Link: '<https://sentry.io/api/0/sentry-apps/?cursor=100:2:0>; rel="next"; results="true"; cursor="100:2:0"',
        },
      });
      const lastPage = MockApiClient.addMockResponse({
        url: '/sentry-apps/',
        asyncDelay: lastPageResponse.promise,
        match: [MockApiClient.matchQuery({status: 'published', cursor: '100:2:0'})],
        body: [
          SentryAppFixture({name: 'Shortcut', slug: 'shortcut', status: 'published'}),
        ],
        headers: {
          Link: '<https://sentry.io/api/0/sentry-apps/?cursor=100:3:0>; rel="next"; results="false"; cursor="100:3:0"',
        },
      });

      render(<IntegrationListDirectory />, {organization});

      await waitFor(() => expect(secondPage).toHaveBeenCalledTimes(1));
      expect(screen.queryByRole('textbox', {name: 'Filter'})).not.toBeInTheDocument();
      await act(async () => {
        secondPageResponse.resolve();
        await secondPageResponse.promise;
      });
      await waitFor(() => expect(lastPage).toHaveBeenCalledTimes(1));
      expect(screen.queryByRole('textbox', {name: 'Filter'})).not.toBeInTheDocument();
      await act(async () => {
        lastPageResponse.resolve();
        await lastPageResponse.promise;
      });
      expect(await screen.findByRole('link', {name: 'Shortcut'})).toBeInTheDocument();
      expect(screen.getByRole('link', {name: 'Split'})).toBeInTheDocument();
      expect(screen.getByRole('link', {name: 'ClickUp'})).toBeInTheDocument();
      expect(firstPage).toHaveBeenCalledTimes(1);
      expect(secondPage).toHaveBeenCalledTimes(1);
      expect(lastPage).toHaveBeenCalledTimes(1);

      await userEvent.type(screen.getByRole('textbox', {name: 'Filter'}), 'shortcut');
      await userEvent.keyboard('{enter}');

      expect(screen.getByRole('link', {name: 'Shortcut'})).toBeInTheDocument();
      expect(screen.queryByRole('link', {name: 'Split'})).not.toBeInTheDocument();
      expect(screen.queryByRole('link', {name: 'ClickUp'})).not.toBeInTheDocument();
      expect(trackAnalytics).toHaveBeenLastCalledWith(
        'integrations.directory_item_searched',
        expect.objectContaining({search_term: 'shortcut', num_results: 1})
      );
    });

    it('stops loading if a subsequent published app page fails', async () => {
      MockApiClient.addMockResponse({
        url: '/sentry-apps/',
        match: [MockApiClient.matchQuery({status: 'published', cursor: undefined})],
        body: PublishedAppsFixture(),
        headers: {
          Link: '<https://sentry.io/api/0/sentry-apps/?cursor=100:1:0>; rel="next"; results="true"; cursor="100:1:0"',
        },
      });
      const failedPage = MockApiClient.addMockResponse({
        url: '/sentry-apps/',
        match: [MockApiClient.matchQuery({status: 'published', cursor: '100:1:0'})],
        statusCode: 400,
        body: {detail: 'Unable to load apps'},
      });

      render(<IntegrationListDirectory />, {organization});

      expect(await screen.findByRole('link', {name: 'ClickUp'})).toBeInTheDocument();
      expect(failedPage).toHaveBeenCalledTimes(1);
    });

    it('tracks searches with the number of results shown', async () => {
      const {router} = render(<IntegrationListDirectory />, {organization});
      expect(await screen.findByRole('textbox', {name: 'Filter'})).toBeInTheDocument();

      await userEvent.type(screen.getByRole('textbox', {name: 'Filter'}), 'it');
      await userEvent.keyboard('{enter}');

      expect(trackAnalytics).toHaveBeenLastCalledWith(
        'integrations.directory_item_searched',
        expect.objectContaining({search_term: 'it', num_results: 2})
      );

      router.navigate('/mock-pathname/?category=unpublished');
      await userEvent.type(screen.getByRole('textbox', {name: 'Filter'}), 'it');
      await userEvent.keyboard('{enter}');

      expect(trackAnalytics).toHaveBeenLastCalledWith(
        'integrations.directory_item_searched',
        expect.objectContaining({search_term: 'it', num_results: 1})
      );

      // The legacy webhook row renders as a result, so it counts as one
      router.navigate('/mock-pathname/');
      await userEvent.type(screen.getByRole('textbox', {name: 'Filter'}), 'legacy');
      await userEvent.keyboard('{enter}');

      expect(screen.getByText('Webhooks (Legacy)')).toBeInTheDocument();
      expect(trackAnalytics).toHaveBeenLastCalledWith(
        'integrations.directory_item_searched',
        expect.objectContaining({search_term: 'legacy', num_results: 1})
      );
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
