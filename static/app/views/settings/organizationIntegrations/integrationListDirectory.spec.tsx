import {DocIntegration as DocIntegrationFixture} from 'sentry-fixture/docIntegration';
import {
  BitbucketIntegrationConfig,
  OrgOwnedApps,
  PluginListConfig,
  ProviderList,
  PublishedApps,
  SentryAppInstalls,
} from 'sentry-fixture/integrationListDirectory';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen} from 'sentry-test/reactTestingLibrary';

import IntegrationListDirectory from 'sentry/views/settings/organizationIntegrations/integrationListDirectory';

const mockResponse = mocks => {
  mocks.forEach(([url, body]) => MockApiClient.addMockResponse({url, body}));
};

describe('IntegrationListDirectory', function () {
  beforeEach(function () {
    MockApiClient.clearMockResponses();
  });

  const {organization: org, routerContext, routerProps} = initializeOrg();

  describe('Renders view', function () {
    beforeEach(() => {
      mockResponse([
        [`/organizations/${org.slug}/config/integrations/`, ProviderList()],
        [`/organizations/${org.slug}/integrations/`, [BitbucketIntegrationConfig()]],
        [`/organizations/${org.slug}/sentry-apps/`, OrgOwnedApps()],
        ['/sentry-apps/', PublishedApps()],
        ['/doc-integrations/', [DocIntegrationFixture()]],
        [`/organizations/${org.slug}/sentry-app-installations/`, SentryAppInstalls()],
        [`/organizations/${org.slug}/plugins/configs/`, PluginListConfig()],
        [`/organizations/${org.slug}/repos/?status=unmigratable`, []],
      ]);
    });

    it('shows installed integrations at the top in order of weight', function () {
      render(
        <IntegrationListDirectory
          {...routerProps}
          params={{orgId: org.slug}}
          routeParams={{orgId: org.slug}}
          hideHeader={false}
        />,
        {
          context: routerContext,
        }
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
        <IntegrationListDirectory
          {...routerProps}
          params={{orgId: org.slug}}
          routeParams={{orgId: org.slug}}
          hideHeader={false}
        />,
        {context: routerContext}
      );

      expect(screen.queryByText('GitHub (Legacy)')).not.toBeInTheDocument();
    });

    it('shows legacy plugin that has a First Party Integration if installed', function () {
      render(
        <IntegrationListDirectory
          {...routerProps}
          params={{orgId: org.slug}}
          routeParams={{orgId: org.slug}}
          hideHeader={false}
        />,
        {context: routerContext}
      );

      expect(screen.getByText('PagerDuty (Legacy)')).toBeInTheDocument();
    });
  });
});
