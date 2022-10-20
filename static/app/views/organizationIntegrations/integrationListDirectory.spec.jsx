import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen} from 'sentry-test/reactTestingLibrary';

import {Client} from 'sentry/api';
import IntegrationListDirectory from 'sentry/views/organizationIntegrations/integrationListDirectory';

const mockResponse = mocks => {
  mocks.forEach(([url, body]) => Client.addMockResponse({url, body}));
};

describe('IntegrationListDirectory', function () {
  beforeEach(function () {
    Client.clearMockResponses();
  });

  const {org, routerContext} = initializeOrg();

  describe('Renders view', function () {
    beforeEach(() => {
      mockResponse([
        [`/organizations/${org.slug}/config/integrations/`, TestStubs.ProviderList()],
        [
          `/organizations/${org.slug}/integrations/`,
          [TestStubs.BitbucketIntegrationConfig()],
        ],
        [`/organizations/${org.slug}/sentry-apps/`, TestStubs.OrgOwnedApps()],
        ['/sentry-apps/', TestStubs.PublishedApps()],
        ['/doc-integrations/', [TestStubs.DocIntegration()]],
        [
          `/organizations/${org.slug}/sentry-app-installations/`,
          TestStubs.SentryAppInstalls(),
        ],
        [`/organizations/${org.slug}/plugins/configs/`, TestStubs.PluginListConfig()],
        [`/organizations/${org.slug}/repos/?status=unmigratable`, []],
      ]);
    });

    it('shows installed integrations at the top in order of weight', function () {
      render(
        <IntegrationListDirectory params={{orgId: org.slug}} location={{search: ''}} />,
        {context: routerContext}
      );

      expect(screen.getByRole('textbox', {name: 'Filter'})).toBeInTheDocument();

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

    it('does not show legacy plugin that has a First Party Integration if not installed', function () {
      render(
        <IntegrationListDirectory params={{orgId: org.slug}} location={{search: ''}} />,
        {context: routerContext}
      );

      expect(screen.queryByText('GitHub (Legacy)')).not.toBeInTheDocument();
    });

    it('shows legacy plugin that has a First Party Integration if installed', function () {
      render(
        <IntegrationListDirectory params={{orgId: org.slug}} location={{search: ''}} />,
        {context: routerContext}
      );

      expect(screen.getByText('PagerDuty (Legacy)')).toBeInTheDocument();
    });
  });
});
