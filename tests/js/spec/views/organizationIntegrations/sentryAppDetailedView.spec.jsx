import React from 'react';

import {Client} from 'app/api';
import {mountWithTheme} from 'sentry-test/enzyme';
import {mockRouterPush} from 'sentry-test/mockRouterPush';
import {initializeOrg} from 'sentry-test/initializeOrg';

import SentryAppDetailedView from 'app/views/organizationIntegrations/sentryAppDetailedView';

const mockResponse = mocks => {
  mocks.forEach(([url, body, method = 'GET']) => {
    return Client.addMockResponse({
      url,
      body,
      method,
    });
  });
};

describe('SentryAppDetailedView', function() {
  const org = TestStubs.Organization();
  const routerContext = TestStubs.routerContext();
  let wrapper;
  const {router} = initializeOrg({
    projects: [
      {isMember: true, isBookmarked: true},
      {isMember: true, slug: 'new-project', id: 3},
    ],
    organization: {
      features: ['events', 'internal-catchall'],
    },
    router: {
      location: {
        pathname: '/organizations/org-slug/events/',
        query: {},
      },
    },
  });

  describe('Published Sentry App', function() {
    beforeEach(() => {
      Client.clearMockResponses();

      mockResponse([
        [
          '/sentry-apps/clickup/',
          {
            status: 'published',
            scopes: [],
            isAlertable: false,
            clientSecret:
              '193583e573d14d61832de96a9efc32ceb64e59a494284f58b50328a656420a55',
            overview: null,
            verifyInstall: false,
            owner: {id: 1, slug: 'sentry'},
            slug: 'clickup',
            name: 'ClickUp',
            uuid: '5d547ecb-7eb8-4ed2-853b-40256177d526',
            author: 'Nisanthan',
            webhookUrl: 'http://localhost:7000',
            clientId: 'c215db1accc040919e0b0dce058e0ecf4ea062bb82174d70aee8eba62351be24',
            redirectUrl: null,
            allowedOrigins: [],
            events: [],
            schema: {},
          },
        ],
        [
          '/sentry-apps/clickup/features/',
          [
            {
              featureGate: 'integrations-api',
              description:
                'ClickUp can **utilize the Sentry API** to pull data or update resources in Sentry (with permissions granted, of course).',
            },
          ],
        ],
        [`/organizations/${org.slug}/sentry-app-installations/`, []],
        [
          `/organizations/${org.slug}/sentry-app-installations/`,
          {
            status: 'installed',
            organization: {slug: `${org.slug}`},
            app: {uuid: '5d547ecb-7eb8-4ed2-853b-40256177d526', slug: 'clickup'},
            code: '1dc8b0a28b7f45959d01bbc99d9bd568',
            uuid: '687323fd-9fa4-4f8f-9bee-ca0089224b3e',
          },
          'POST',
        ],
      ]);

      wrapper = mountWithTheme(
        <SentryAppDetailedView
          params={{integrationSlug: 'clickup', orgId: org.slug}}
          location={{query: {}}}
        />,
        routerContext
      );
    });
    it('shows the Integration name and install status', async function() {
      expect(wrapper.find('Name').props().children).toEqual('ClickUp');
      expect(wrapper.find('IntegrationStatus').props().status).toEqual('Not Installed');
    });
    it('shows the Accept & Install button', async function() {
      expect(wrapper.find('InstallButton').props().disabled).toEqual(false);
      expect(wrapper.find('InstallButton').props().children).toEqual('Accept & Install');
    });

    it('onClick: installs app', async function() {
      wrapper.find('InstallButton').simulate('click');
      await tick();
      wrapper.update();
      expect(wrapper.find('IntegrationStatus').props().status).toEqual('Installed');
    });
  });

  describe('Internal Sentry App', function() {
    beforeEach(() => {
      Client.clearMockResponses();

      mockResponse([
        [
          '/sentry-apps/my-headband-washer-289499/',
          {
            status: 'internal',
            scopes: [
              'project:read',
              'team:read',
              'team:write',
              'project:releases',
              'event:read',
              'org:read',
              'member:read',
              'member:write',
            ],
            isAlertable: false,
            clientSecret:
              '8f47dcef40f7486f9bacfeca257022e092a483add7cf4d619993b9ace9775a79',
            overview: null,
            verifyInstall: false,
            owner: {id: 1, slug: 'sentry'},
            slug: 'my-headband-washer-289499',
            name: 'My Headband Washer',
            uuid: 'a806ab10-9608-4a4f-8dd9-ca6d6c09f9f5',
            author: 'Sentry',
            webhookUrl: 'https://myheadbandwasher.com',
            clientId: 'a6d35972d4164ef18845b1e2ca954fe70ac196e0b20d4d1e8760a38772cf6f1c',
            redirectUrl: null,
            allowedOrigins: [],
            events: [],
            schema: {},
          },
        ],
        [
          '/sentry-apps/my-headband-washer-289499/features/',
          [
            {
              featureGate: 'integrations-api',
              description:
                'My Headband Washer can **utilize the Sentry API** to pull data or update resources in Sentry (with permissions granted, of course).',
            },
          ],
        ],
        [`/organizations/${org.slug}/sentry-app-installations/`, []],
      ]);

      wrapper = mountWithTheme(
        <SentryAppDetailedView
          params={{integrationSlug: 'my-headband-washer-289499', orgId: org.slug}}
          location={{query: {}}}
          router={router}
        />,
        routerContext
      );

      mockRouterPush(wrapper, router);
    });
    it('should get redirected to Developer Settings', () => {
      expect(router.push).toHaveBeenLastCalledWith(
        `/settings/${org.slug}/developer-settings/my-headband-washer-289499/`
      );
    });
  });

  describe('Unpublished Sentry App', function() {
    beforeEach(() => {
      Client.clearMockResponses();

      mockResponse([
        [
          '/sentry-apps/la-croix-monitor/',
          {
            status: 'unpublished',
            scopes: [
              'project:read',
              'project:write',
              'team:read',
              'project:releases',
              'event:read',
              'org:read',
            ],
            isAlertable: false,
            clientSecret:
              '2b2aeb743c3745ab832e03bf02a7d91851908d379646499f900cd115780e8b2b',
            overview: null,
            verifyInstall: false,
            owner: {id: 1, slug: 'sentry'},
            slug: 'la-croix-monitor',
            name: 'La Croix Monitor',
            uuid: 'a59c8fcc-2f27-49f8-af9e-02661fc3e8d7',
            author: 'La Croix',
            webhookUrl: 'https://lacroix.com',
            clientId: '8cc36458a0f94c93816e06dce7d808f882cbef59af6040d2b9ec4d67092c80f1',
            redirectUrl: null,
            allowedOrigins: [],
            events: [],
            schema: {},
          },
        ],
        [
          '/sentry-apps/la-croix-monitor/features/',
          [
            {
              featureGate: 'integrations-api',
              description:
                'La Croix Monitor can **utilize the Sentry API** to pull data or update resources in Sentry (with permissions granted, of course).',
            },
          ],
        ],
        [`/organizations/${org.slug}/sentry-app-installations/`, []],
        [
          `/organizations/${org.slug}/sentry-app-installations/`,
          {
            status: 'installed',
            organization: {slug: 'sentry'},
            app: {uuid: 'a59c8fcc-2f27-49f8-af9e-02661fc3e8d7', slug: 'la-croix-monitor'},
            code: '21c87231918a4e5c85d9b9e799c07382',
            uuid: '258ad77c-7e6c-4cfe-8a40-6171cff30d61',
          },
          'POST',
        ],
      ]);

      wrapper = mountWithTheme(
        <SentryAppDetailedView
          params={{integrationSlug: 'la-croix-monitor', orgId: org.slug}}
          location={{query: {}}}
        />,
        routerContext
      );
    });
    it('shows the Integration name and install status', async function() {
      expect(wrapper.find('Name').props().children).toEqual('La Croix Monitor');
      expect(wrapper.find('IntegrationStatus').props().status).toEqual('Not Installed');
    });
    it('shows the Accept & Install button', async function() {
      expect(wrapper.find('InstallButton').props().disabled).toEqual(false);
      expect(wrapper.find('InstallButton').props().children).toEqual('Accept & Install');
    });

    it('onClick: installs app', async function() {
      wrapper.find('InstallButton').simulate('click');
      await tick();
      wrapper.update();
      expect(wrapper.find('IntegrationStatus').props().status).toEqual('Installed');
      expect(wrapper.find('UninstallButton').exists()).toEqual(true);
    });
  });
});
