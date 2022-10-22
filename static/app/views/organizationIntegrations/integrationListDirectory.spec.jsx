import {BitbucketIntegrationConfig} from 'fixtures/js-stubs/bitbucketIntegrationConfig';
import {DocIntegration} from 'fixtures/js-stubs/docIntegration';
import {OrgOwnedApps} from 'fixtures/js-stubs/orgOwnedApps';
import {PluginListConfig} from 'fixtures/js-stubs/pluginListConfig';
import {ProviderList} from 'fixtures/js-stubs/providerList';
import {PublishedApps} from 'fixtures/js-stubs/publishedApps';
import {SentryAppInstalls} from 'fixtures/js-stubs/sentryAppInstalls';

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
        [`/organizations/${org.slug}/config/integrations/`, ProviderList()],
        [`/organizations/${org.slug}/integrations/`, [BitbucketIntegrationConfig()]],
        [`/organizations/${org.slug}/sentry-apps/`, OrgOwnedApps()],
        ['/sentry-apps/', PublishedApps()],
        ['/doc-integrations/', [DocIntegration()]],
        [`/organizations/${org.slug}/sentry-app-installations/`, SentryAppInstalls()],
        [`/organizations/${org.slug}/plugins/configs/`, PluginListConfig()],
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
