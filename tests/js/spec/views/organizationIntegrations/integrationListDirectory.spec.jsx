import React from 'react';

import {mountWithTheme} from 'sentry-test/enzyme';
import {initializeOrg} from 'sentry-test/initializeOrg';

import {Client} from 'app/api';
import IntegrationListDirectory from 'app/views/organizationIntegrations/integrationListDirectory';

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
        [`/organizations/${org.slug}/integrations/`, TestStubs.IntegrationConfig()],
        [`/organizations/${org.slug}/sentry-apps/`, TestStubs.OrgOwnedApps()],
        ['/sentry-apps/', TestStubs.PublishedApps()],
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

    it('shows installed integrations at the top in order of weight', async function () {
      expect(wrapper.find('SearchBar').exists()).toBeTruthy();
      expect(wrapper.find('PanelBody').exists()).toBeTruthy();
      expect(wrapper.find('IntegrationRow')).toHaveLength(13);

      [
        'bitbucket',
        'pagerduty',
        'my-headband-washer-289499',
        'clickup',
        'asayer',
        'bitbucket_pipelines',
        'datadog',
        'fullstory',
        'github_actions',
        'netlify',
        'rocketchat',
        'amazon-sqs',
        'la-croix-monitor',
      ].map((name, index) =>
        expect(wrapper.find('IntegrationRow').at(index).props().slug).toEqual(name)
      );
    });

    it('does not show legacy plugin that has a First Party Integration if not installed', async function () {
      wrapper.find('IntegrationRow').forEach(node => {
        expect(node.props().displayName).not.toEqual('Github (Legacy)');
      });
    });

    it('shows legacy plugin that has a First Party Integration if installed', async function () {
      const legacyPluginRow = wrapper
        .find('IntegrationRow')
        .filterWhere(node => node.props().displayName === 'PagerDuty (Legacy)');

      expect(legacyPluginRow).toHaveLength(1);
    });
  });
});
