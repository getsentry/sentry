/*global global*/
import React from 'react';
import {mount} from 'enzyme';

import {Client} from 'app/api';
import {
  openIntegrationDetails,
  openSentryAppDetailsModal,
} from 'app/actionCreators/modal';
import {OrganizationIntegrations} from 'app/views/organizationIntegrations';

jest.mock('app/actionCreators/modal', () => ({
  openIntegrationDetails: jest.fn(),
  openSentryAppDetailsModal: jest.fn(),
}));

describe('OrganizationIntegrations', () => {
  let wrapper;

  let org;
  let sentryApp;

  let githubProvider;
  let jiraProvider;
  let vstsProvider;

  let githubIntegration;
  let jiraIntegration;

  let params;
  let routerContext;

  let publishedSentryAppsRequest;
  let orgOwnedSentryAppsRequest;
  let sentryInstallsRequest;

  let focus;
  let open;

  beforeEach(() => {
    Client.clearMockResponses();

    org = TestStubs.Organization();
    sentryApp = TestStubs.SentryApp();

    githubProvider = TestStubs.GitHubIntegrationProvider({
      integrations: [],
      isInstalled: false,
    });

    jiraProvider = TestStubs.JiraIntegrationProvider();
    vstsProvider = TestStubs.VstsIntegrationProvider();

    githubIntegration = TestStubs.GitHubIntegration();
    jiraIntegration = TestStubs.JiraIntegration();

    params = {orgId: org.slug};

    routerContext = TestStubs.routerContext();

    focus = jest.fn();
    open = jest.fn().mockReturnValue({focus});
    global.open = open;

    Client.addMockResponse({
      url: `/organizations/${org.slug}/integrations/`,
      body: [],
    });

    Client.addMockResponse({
      url: `/organizations/${org.slug}/config/integrations/`,
      body: {providers: [githubProvider, jiraProvider]},
    });

    Client.addMockResponse({
      url: `/organizations/${org.slug}/plugins/`,
      body: [],
    });

    Client.addMockResponse({
      url: `/organizations/${org.slug}/repos/?status=unmigratable`,
      body: [],
    });

    publishedSentryAppsRequest = Client.addMockResponse({
      url: '/sentry-apps/',
      body: [],
    });

    orgOwnedSentryAppsRequest = Client.addMockResponse({
      url: `/organizations/${org.slug}/sentry-apps/`,
      body: [],
    });

    sentryInstallsRequest = Client.addMockResponse({
      url: `/organizations/${org.slug}/sentry-app-installations/`,
      body: [],
    });

    wrapper = mount(
      <OrganizationIntegrations organization={org} params={params} />,
      routerContext
    );
  });

  describe('sorting', () => {
    let installedSentryApp;
    let sentryAppInstall;

    beforeEach(() => {
      org = {...org, features: ['sentry-apps']};

      installedSentryApp = TestStubs.SentryApp({
        name: 'An Integration',
        slug: 'an-integration',
      });

      sentryAppInstall = TestStubs.SentryAppInstallation({
        organization: {
          slug: org.slug,
        },
        app: {
          slug: installedSentryApp.slug,
          uuid: installedSentryApp.uuid,
        },
      });

      Client.addMockResponse({
        url: `/organizations/${org.slug}/integrations/`,
        body: [jiraIntegration],
      });

      Client.addMockResponse({
        url: `/organizations/${org.slug}/sentry-apps/`,
        body: [sentryApp, installedSentryApp],
      });

      Client.addMockResponse({
        url: `/organizations/${org.slug}/sentry-app-installations/`,
        body: [sentryAppInstall],
      });

      wrapper = mount(
        <OrganizationIntegrations organization={org} params={params} />,
        routerContext
      );
    });

    it('places installed Integrations above uninstalled ones', () => {
      // Installed apps are shown at the top of the list
      const installed = wrapper.find('SentryAppInstallations').at(0);
      expect(installed.find('Status').prop('enabled')).toBe(true);

      // Uninstalled are shown lower.
      const uninstalled = wrapper.find('SentryAppInstallations').at(1);
      expect(uninstalled.find('Status').prop('enabled')).toBeFalsy();
    });

    it('sorts Sentry App Integrations among Integrations, alphabetically', () => {
      const rows = wrapper.find('[data-test-id="integration-row"]');

      expect(rows.length).toBe(4);

      // Installed
      expect(
        rows
          .at(0)
          .find('SentryAppName')
          .text()
      ).toMatch(installedSentryApp.name);

      // Uninstalled, alphabetically
      expect(
        rows
          .at(1)
          .find('ProviderName')
          .text()
      ).toMatch('Jira');
      expect(
        rows
          .at(2)
          .find('ProviderName')
          .text()
      ).toMatch('GitHub');
      expect(
        rows
          .at(3)
          .find('SentryAppName')
          .text()
      ).toMatch('Sample App');
    });
  });

  describe('render()', () => {
    describe('without integrations', () => {
      it('renders sentry apps', () => {
        orgOwnedSentryAppsRequest = Client.addMockResponse({
          url: `/organizations/${org.slug}/sentry-apps/`,
          body: [sentryApp],
        });

        mount(
          <OrganizationIntegrations organization={org} params={params} />,
          routerContext
        );

        expect(publishedSentryAppsRequest).toHaveBeenCalled();
        expect(orgOwnedSentryAppsRequest).toHaveBeenCalled();
        expect(sentryInstallsRequest).toHaveBeenCalled();
      });

      it('renders a Learn More modal for Sentry Apps', () => {
        orgOwnedSentryAppsRequest = Client.addMockResponse({
          url: `/organizations/${org.slug}/sentry-apps/`,
          body: [sentryApp],
        });

        wrapper = mount(
          <OrganizationIntegrations organization={org} params={params} />,
          routerContext
        );

        wrapper.find('SentryApplicationRow Link').simulate('click');

        expect(openSentryAppDetailsModal).toHaveBeenCalledWith({
          sentryApp,
          isInstalled: false,
          onInstall: expect.any(Function),
          organization: org,
        });
      });

      it('Opens the integration dialog on install', function() {
        const options = {
          provider: githubProvider,
          onAddIntegration: wrapper.instance().onInstall,
          organization: routerContext.context.organization,
        };

        wrapper
          .find('Button')
          .first()
          .simulate('click');

        expect(openIntegrationDetails).toHaveBeenCalledWith(options);
      });
    });

    describe('published and org-owned apps are consolidated', () => {
      it('renders sentry app once', () => {
        const publishedApp = {...sentryApp, status: 'published'};
        Client.addMockResponse({
          url: `/organizations/${org.slug}/sentry-apps/`,
          body: [publishedApp],
        });
        Client.addMockResponse({
          url: '/sentry-apps/',
          body: [publishedApp],
        });
        wrapper = mount(
          <OrganizationIntegrations organization={org} params={params} />,
          routerContext
        );
        expect(wrapper.find('SentryAppInstallations').length).toBe(1);
      });
    });

    describe('internal apps are separate', () => {
      it('renders internal sentry app', () => {
        const internalApp = {...sentryApp, status: 'internal'};
        Client.addMockResponse({
          url: `/organizations/${org.slug}/sentry-apps/`,
          body: [internalApp],
        });
        Client.addMockResponse({
          url: '/sentry-apps/',
          body: [],
        });
        wrapper = mount(
          <OrganizationIntegrations organization={org} params={params} />,
          routerContext
        );
        expect(
          wrapper.find('Panel [data-test-id="internal-integration-row"]').exists()
        ).toBe(true);
      });
    });

    describe('with installed integrations', () => {
      let updatedIntegration;

      beforeEach(() => {
        Client.addMockResponse({
          url: `/organizations/${org.slug}/integrations/`,
          body: [githubIntegration, jiraIntegration],
        });

        wrapper = mount(
          <OrganizationIntegrations organization={org} params={params} />,
          routerContext
        );

        updatedIntegration = Object.assign({}, githubIntegration, {
          domain_name: 'updated-integration.github.com',
          icon: 'http://example.com/updated-integration-icon.png',
          name: 'Updated Integration',
        });
      });

      it('Displays InstalledIntegration', function() {
        const github = wrapper.find('ProviderRow').first();
        expect(github.find('ProviderName').text()).toEqual(githubProvider.name);
        expect(github.find('IntegrationItem IntegrationName').text()).toEqual(
          githubIntegration.name
        );
      });

      it('Merges installed integrations', () => {
        wrapper.instance().onInstall(updatedIntegration);

        expect(wrapper.instance().state.integrations).toHaveLength(2);
        expect(wrapper.instance().state.integrations[1]).toBe(updatedIntegration);
      });

      it('Deletes an integration', () => {
        Client.addMockResponse({
          url: `/organizations/${org.slug}/integrations/${jiraIntegration.id}/`,
          method: 'DELETE',
          statusCode: 200,
        });

        wrapper.instance().onRemove(jiraIntegration);

        expect(wrapper.instance().state.integrations).toHaveLength(1);
        expect(wrapper.instance().state.integrations[0]).toBe(githubIntegration);
      });
    });

    describe('with matching plugins installed', () => {
      beforeEach(() => {
        Client.addMockResponse({
          url: `/organizations/${org.slug}/integrations/`,
          body: [githubIntegration],
        });

        Client.addMockResponse({
          url: `/organizations/${org.slug}/config/integrations/`,
          body: {providers: [githubProvider, jiraProvider, vstsProvider]},
        });

        Client.addMockResponse({
          url: `/organizations/${org.slug}/plugins/`,
          body: [
            {
              slug: 'github',
              enabled: true,
            },
            {
              slug: 'vsts',
              enabled: true,
            },
            {
              slug: 'jira',
              enabled: true,
            },
          ],
        });

        Client.addMockResponse({
          url: `/organizations/${org.slug}/repos/?status=unmigratable`,
          body: [
            {
              provider: {
                id: 'github',
                name: 'GitHub',
              },
              name: 'Test-Org/foo',
            },
          ],
        });

        wrapper = mount(
          <OrganizationIntegrations organization={org} params={params} />,
          routerContext
        );
      });

      it('displays an Update when the Plugin is enabled but a new Integration is not', () => {
        expect(
          wrapper
            .find('ProviderRow PanelItem[data-test-id="vsts"] Button')
            .first()
            .text()
        ).toBe('Update');
      });

      it('displays Add Another button when both Integration and Plugin are enabled', () => {
        expect(
          wrapper
            .find('ProviderRow PanelItem[data-test-id="github"] Button')
            .first()
            .text()
        ).toBe('Add Another');
      });

      it('display an Install button when its not an upgradable Integration', () => {
        expect(
          wrapper
            .find('ProviderRow PanelItem[data-test-id="jira"] Button')
            .first()
            .text()
        ).toBe('Install');
      });
    });
  });
});
