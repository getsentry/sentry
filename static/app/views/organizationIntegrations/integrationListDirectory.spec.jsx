import {mountWithTheme} from 'sentry-test/enzyme';
import {initializeOrg} from 'sentry-test/initializeOrg';

import {Client} from 'sentry/api';
import IntegrationListDirectory from 'sentry/views/organizationIntegrations/integrationListDirectory';

const mockResponse = mocks => {
  mocks.forEach(([url, body]) =>
    Client.addMockResponse({
      url,
      body,
    })
  );
};

describe('IntegrationListDirectory', function () {
  beforeEach(function () {
    Client.clearMockResponses();
  });

  const {org, routerContext} = initializeOrg();
  let wrapper;

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

      wrapper = mountWithTheme(
        <IntegrationListDirectory params={{orgId: org.slug}} location={{search: ''}} />,
        routerContext
      );
    });

    it('shows installed integrations at the top in order of weight', function () {
      expect(wrapper.find('SearchBar').exists()).toBeTruthy();
      expect(wrapper.find('PanelBody').exists()).toBeTruthy();
      expect(wrapper.find('IntegrationRow')).toHaveLength(7);

      [
        'bitbucket', // 10
        'pagerduty', // 10
        'my-headband-washer-289499', // 10
        'sample-doc', // 10
        'clickup', // 9
        'amazon-sqs', // 8
        'la-croix-monitor', // 8
      ].map((name, index) =>
        expect(wrapper.find('IntegrationRow').at(index).props().slug).toEqual(name)
      );
    });

    it('does not show legacy plugin that has a First Party Integration if not installed', function () {
      wrapper.find('IntegrationRow').forEach(node => {
        expect(node.props().displayName).not.toEqual('Github (Legacy)');
      });
    });

    it('shows legacy plugin that has a First Party Integration if installed', function () {
      const legacyPluginRow = wrapper
        .find('IntegrationRow')
        .filterWhere(node => node.props().displayName === 'PagerDuty (Legacy)');

      expect(legacyPluginRow).toHaveLength(1);
    });
  });
});
