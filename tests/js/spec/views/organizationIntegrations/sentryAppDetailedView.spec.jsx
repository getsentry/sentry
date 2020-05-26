import React from 'react';

import {mountWithTheme} from 'sentry-test/enzyme';
import {mockRouterPush} from 'sentry-test/mockRouterPush';
import {initializeOrg} from 'sentry-test/initializeOrg';

import {Client} from 'app/api';
import SentryAppDetailedView from 'app/views/organizationIntegrations/sentryAppDetailedView';

const mockResponse = mocks => {
  mocks.forEach(([url, body, method = 'GET']) =>
    Client.addMockResponse({
      url,
      body,
      method,
    })
  );
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
    let createRequest;
    let deleteRequest;
    let sentryAppInteractionRequest;

    beforeEach(() => {
      Client.clearMockResponses();

      sentryAppInteractionRequest = MockApiClient.addMockResponse({
        url: `/sentry-apps/clickup/interaction/`,
        method: 'POST',
        statusCode: 200,
        body: {},
      });

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
      ]);

      createRequest = Client.addMockResponse({
        url: `/organizations/${org.slug}/sentry-app-installations/`,
        body: {
          status: 'installed',
          organization: {slug: `${org.slug}`},
          app: {uuid: '5d547ecb-7eb8-4ed2-853b-40256177d526', slug: 'clickup'},
          code: '1dc8b0a28b7f45959d01bbc99d9bd568',
          uuid: '687323fd-9fa4-4f8f-9bee-ca0089224b3e',
        },
        method: 'POST',
      });

      deleteRequest = Client.addMockResponse({
        url: '/sentry-app-installations/687323fd-9fa4-4f8f-9bee-ca0089224b3e/',
        body: {},
        method: 'DELETE',
      });
      wrapper = mountWithTheme(
        <SentryAppDetailedView
          params={{integrationSlug: 'clickup', orgId: org.slug}}
          location={{query: {}}}
        />,
        routerContext
      );
    });

    it('records interaction request', () => {
      expect(sentryAppInteractionRequest).toHaveBeenCalledWith(
        `/sentry-apps/clickup/interaction/`,
        expect.objectContaining({
          method: 'POST',
          data: {
            tsdbField: 'sentry_app_viewed',
          },
        })
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

    describe('onClick: ', function() {
      let wrapperState;

      it('installs app', async function() {
        wrapper.find('InstallButton').simulate('click');
        await tick();
        await tick();
        expect(createRequest).toHaveBeenCalled();
        wrapper.update();
        wrapperState = wrapper;
        expect(wrapper.find('IntegrationStatus').props().status).toEqual('Installed');
        expect(wrapper.find('StyledUninstallButton').exists()).toEqual(true);
      });

      it('uninstalls app', async function() {
        expect(wrapperState.find('StyledUninstallButton')).toHaveLength(1);
        wrapperState.find('StyledUninstallButton').simulate('click');

        await tick();
        wrapperState
          .find('Confirm')
          .props()
          .onConfirm();
        await tick();
        expect(deleteRequest).toHaveBeenCalled();
      });
    });
  });

  describe('Internal Sentry App', function() {
    beforeEach(() => {
      Client.clearMockResponses();

      MockApiClient.addMockResponse({
        url: `/sentry-apps/my-headband-washer-289499/interaction/`,
        method: 'POST',
        statusCode: 200,
        body: {},
      });

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

  describe('Unpublished Sentry App without Redirect Url', function() {
    let createRequest;

    beforeEach(() => {
      Client.clearMockResponses();

      MockApiClient.addMockResponse({
        url: `/sentry-apps/la-croix-monitor/interaction/`,
        method: 'POST',
        statusCode: 200,
        body: {},
      });

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
      ]);

      createRequest = Client.addMockResponse({
        url: `/organizations/${org.slug}/sentry-app-installations/`,
        body: {
          status: 'installed',
          organization: {slug: 'sentry'},
          app: {uuid: 'a59c8fcc-2f27-49f8-af9e-02661fc3e8d7', slug: 'la-croix-monitor'},
          code: '21c87231918a4e5c85d9b9e799c07382',
          uuid: '258ad77c-7e6c-4cfe-8a40-6171cff30d61',
        },
        method: 'POST',
      });

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
      expect(createRequest).toHaveBeenCalled();
      wrapper.update();
      expect(wrapper.find('IntegrationStatus').props().status).toEqual('Installed');
      expect(wrapper.find('StyledUninstallButton').exists()).toEqual(true);
    });
  });

  describe('Unpublished Sentry App with Redirect Url', function() {
    let createRequest;
    beforeEach(() => {
      Client.clearMockResponses();

      MockApiClient.addMockResponse({
        url: `/sentry-apps/go-to-google/interaction/`,
        method: 'POST',
        statusCode: 200,
        body: {},
      });

      mockResponse([
        [
          '/sentry-apps/go-to-google/',
          {
            status: 'unpublished',
            scopes: ['project:read', 'team:read'],
            isAlertable: false,
            clientSecret:
              '6405a4a7b8084cdf8dbea53b53e2163983deb428b78e4c6997bc408d44d93878',
            overview: null,
            verifyInstall: false,
            owner: {id: 1, slug: 'sentry'},
            slug: 'go-to-google',
            name: 'Go to Google',
            uuid: 'a4b8f364-4300-41ac-b8af-d8791ad50e77',
            author: 'Nisanthan Nanthakumar',
            webhookUrl: 'https://www.google.com',
            clientId: '0974b5df6b57480b99c2e1f238eef769ef2c27ec156d4791a26903a896d5807e',
            redirectUrl: 'https://www.google.com',
            allowedOrigins: [],
            events: [],
            schema: {},
          },
        ],
        [
          '/sentry-apps/go-to-google/features/',
          [
            {
              featureGate: 'integrations-api',
              description:
                'Go to Google can **utilize the Sentry API** to pull data or update resources in Sentry (with permissions granted, of course).',
            },
          ],
        ],
        [`/organizations/${org.slug}/sentry-app-installations/`, []],
      ]);

      createRequest = Client.addMockResponse({
        url: `/organizations/${org.slug}/sentry-app-installations/`,
        body: {
          status: 'installed',
          organization: {slug: 'sentry'},
          app: {uuid: 'a4b8f364-4300-41ac-b8af-d8791ad50e77', slug: 'go-to-google'},
          code: '1f0e7c1b99b940abac7a19b86e69bbe1',
          uuid: '4d803538-fd42-4278-b410-492f5ab677b5',
        },
        method: 'POST',
      });

      wrapper = mountWithTheme(
        <SentryAppDetailedView
          params={{integrationSlug: 'go-to-google', orgId: org.slug}}
          location={{query: {}}}
          router={router}
        />,
        routerContext
      );
      mockRouterPush(wrapper, router);
    });
    it('shows the Integration name and install status', async function() {
      expect(wrapper.find('Name').props().children).toEqual('Go to Google');
      expect(wrapper.find('IntegrationStatus').props().status).toEqual('Not Installed');
    });
    it('shows the Accept & Install button', async function() {
      expect(wrapper.find('InstallButton').props().disabled).toEqual(false);
      expect(wrapper.find('InstallButton').props().children).toEqual('Accept & Install');
    });

    it('onClick: redirects url', async function() {
      window.location.assign = jest.fn();

      wrapper.find('InstallButton').simulate('click');
      await tick();
      expect(createRequest).toHaveBeenCalled();

      wrapper.update();
      expect(window.location.assign).toHaveBeenLastCalledWith(
        'https://www.google.com/?code=1f0e7c1b99b940abac7a19b86e69bbe1&installationId=4d803538-fd42-4278-b410-492f5ab677b5&orgSlug=org-slug'
      );
    });
  });
});
