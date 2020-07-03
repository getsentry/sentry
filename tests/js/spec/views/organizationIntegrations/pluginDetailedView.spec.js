import React from 'react';

import {mountWithTheme} from 'sentry-test/enzyme';

import {Client} from 'app/api';
import PluginDetailedView from 'app/views/organizationIntegrations/pluginDetailedView';
import * as modal from 'app/actionCreators/modal';

const mockResponse = mocks => {
  mocks.forEach(([url, body]) =>
    Client.addMockResponse({
      url,
      body,
    })
  );
};

describe('PluginDetailedView', function() {
  const org = TestStubs.Organization();
  const routerContext = TestStubs.routerContext();
  let wrapper;

  beforeEach(() => {
    Client.clearMockResponses();

    mockResponse([
      [
        `/organizations/${org.slug}/plugins/configs/?plugins=pagerduty`,
        [
          {
            status: 'unknown',
            description: 'Send alerts to PagerDuty.',
            isTestable: true,
            isHidden: true,
            hasConfiguration: true,
            features: [],
            shortName: 'PagerDuty',
            id: 'pagerduty',
            assets: [],
            featureDescriptions: [],
            name: 'PagerDuty',
            author: {url: 'https://github.com/getsentry/sentry', name: 'Sentry Team'},
            contexts: [],
            doc: '',
            resourceLinks: [
              {url: 'https://github.com/getsentry/sentry/issues', title: 'Report Issue'},
              {
                url: 'https://github.com/getsentry/sentry/tree/master/src/sentry_plugins',
                title: 'View Source',
              },
            ],
            slug: 'pagerduty',
            projectList: [
              {
                projectId: 2,
                configured: true,
                enabled: true,
                projectSlug: 'javascript',

                projectPlatform: 'javascript',
                projectName: 'JavaScript',
              },
            ],
            version: '10.1.0.dev0',
            canDisable: true,
            type: 'notification',
            metadata: {},
          },
        ],
      ],
    ]);

    wrapper = mountWithTheme(
      <PluginDetailedView
        params={{integrationSlug: 'pagerduty', orgId: org.slug}}
        location={{query: {}}}
      />,
      routerContext
    );
  });
  it('shows the Integration name and install status', async function() {
    expect(wrapper.find('Name').props().children).toEqual('PagerDuty (Legacy)');
    expect(wrapper.find('IntegrationStatus').props().status).toEqual('Installed');
  });
  it('shows the Add to Project button', async function() {
    expect(wrapper.find('AddButton').props().disabled).toEqual(false);
    expect(wrapper.find('AddButton').props().children).toEqual('Add to Project');
  });

  it('onClick', async function() {
    modal.openModal = jest.fn();
    wrapper.find('AddButton').simulate('click');
    expect(modal.openModal).toHaveBeenCalled();
  });

  it('view configurations', async function() {
    wrapper = mountWithTheme(
      <PluginDetailedView
        params={{integrationSlug: 'pagerduty', orgId: org.slug}}
        location={{query: {tab: 'configurations'}}}
      />,
      routerContext
    );
    expect(wrapper.find('InstalledPlugin')).toHaveLength(1);
  });
});
