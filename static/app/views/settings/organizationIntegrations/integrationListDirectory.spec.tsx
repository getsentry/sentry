import {DocIntegrationFixture} from 'sentry-fixture/docIntegration';
import {
  BitbucketIntegrationConfigFixture,
  OrgOwnedAppsFixture,
  PluginListConfigFixture,
  ProviderListFixture,
  PublishedAppsFixture,
  SentryAppInstallsFixture,
} from 'sentry-fixture/integrationListDirectory';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen} from 'sentry-test/reactTestingLibrary';

import IntegrationListDirectory from 'sentry/views/settings/organizationIntegrations/integrationListDirectory';

const mockResponse = (mocks: [string, unknown][]) => {
  mocks.forEach(([url, body]) => MockApiClient.addMockResponse({url, body}));
};

describe('IntegrationListDirectory', function () {
  beforeEach(function () {
    MockApiClient.clearMockResponses();
  });

  const {organization: org, router, routerProps} = initializeOrg();

  describe('Renders view', function () {
    beforeEach(() => {
      mockResponse([
        [`/organizations/${org.slug}/config/integrations/`, ProviderListFixture()],
        [
          `/organizations/${org.slug}/integrations/`,
          [BitbucketIntegrationConfigFixture()],
        ],
        [`/organizations/${org.slug}/sentry-apps/`, OrgOwnedAppsFixture()],
        ['/sentry-apps/', PublishedAppsFixture()],
        ['/doc-integrations/', [DocIntegrationFixture()]],
        [
          `/organizations/${org.slug}/sentry-app-installations/`,
          SentryAppInstallsFixture(),
        ],
        [`/organizations/${org.slug}/plugins/configs/`, PluginListConfigFixture()],
        [`/organizations/${org.slug}/repos/?status=unmigratable`, []],
      ]);
    });

    it('shows installed integrations at the top in order of weight', async function () {
      render(
        <IntegrationListDirectory
          {...routerProps}
          params={{orgId: org.slug}}
          routeParams={{orgId: org.slug}}
          hideHeader={false}
        />,
        {
          router,
        }
      );

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

    it('does not show legacy plugin that has a First Party Integration if not installed', async function () {
      render(
        <IntegrationListDirectory
          {...routerProps}
          params={{orgId: org.slug}}
          routeParams={{orgId: org.slug}}
          hideHeader={false}
        />,
        {router}
      );

      expect(await screen.findByRole('textbox', {name: 'Filter'})).toBeInTheDocument();
      expect(screen.queryByText('GitHub (Legacy)')).not.toBeInTheDocument();
    });

    it('shows legacy plugin that has a First Party Integration if installed', async function () {
      render(
        <IntegrationListDirectory
          {...routerProps}
          params={{orgId: org.slug}}
          routeParams={{orgId: org.slug}}
          hideHeader={false}
        />,
        {router}
      );

      expect(await screen.findByText('PagerDuty (Legacy)')).toBeInTheDocument();
    });
  });
});
