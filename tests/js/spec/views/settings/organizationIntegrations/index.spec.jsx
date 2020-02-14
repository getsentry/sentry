/*global global*/
import React from 'react';
import {mountWithTheme} from 'sentry-test/enzyme';

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

  let routerContext;

  let publishedSentryAppsRequest;
  let orgOwnedSentryAppsRequest;
  let sentryInstallsRequest;

  let focus;
  let open;
  let otherProps;

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

    routerContext = TestStubs.routerContext();

    focus = jest.fn();
    open = jest.fn().mockReturnValue({focus});
    global.open = open;

    otherProps = {
      location: {
        search: '',
      },
      params: {orgId: org.slug},
    };

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

    wrapper = mountWithTheme(
      <OrganizationIntegrations organization={org} {...otherProps} />,
      routerContext
    );
  });

  describe('sorting', () => {
    let installedSentryApp;
    let sentryAppInstall;

    beforeEach(() => {
      installedSentryApp = TestStubs.SentryApp({
        name: 'An Integration',
        slug: 'an-integration',
        status: 'published',
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

      wrapper = mountWithTheme(
        <OrganizationIntegrations organization={org} {...otherProps} />,
        routerContext
      );
    });

    it('places installed Integrations above uninstalled ones', () => {
      // Installed apps are shown at the top of the list
      const installed = wrapper.find('SentryAppInstallationDetail').at(0);
      expect(installed.find('StatusIndicator').prop('status')).toBe('Installed');

      // Uninstalled are shown lower.
      const uninstalled = wrapper.find('SentryAppInstallationDetail').at(1);
      expect(uninstalled.find('StatusIndicator').prop('status')).toBe('Not Installed');
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

        mountWithTheme(
          <OrganizationIntegrations organization={org} {...otherProps} />,
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

        wrapper = mountWithTheme(
          <OrganizationIntegrations organization={org} {...otherProps} />,
          routerContext
        );

        wrapper.find('SentryApplicationRow Link').simulate('click');

        expect(openSentryAppDetailsModal).toHaveBeenCalledWith({
          sentryApp,
          isInstalled: false,
          onInstall: expect.any(Function),
          onCloseModal: expect.any(Function),
          organization: org,
        });
      });

      it('Opens the integration dialog on install', function() {
        const options = {
          provider: githubProvider,
          onAddIntegration: wrapper.instance().onInstall,
          organization: routerContext.context.organization,
          isInstalled: false,
          onCloseModal: expect.any(Function),
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
        wrapper = mountWithTheme(
          <OrganizationIntegrations organization={org} {...otherProps} />,
          routerContext
        );
        expect(wrapper.find('SentryAppInstallationDetail').length).toBe(1);
      });
    });

    describe('pending applications', () => {
      it('renders the pending status', () => {
        const installedSentryApp = TestStubs.SentryApp({
          name: 'An Integration',
          slug: 'an-integration',
        });

        const sentryAppInstall = TestStubs.SentryAppInstallation({
          organization: {
            slug: org.slug,
          },
          app: {
            slug: installedSentryApp.slug,
            uuid: installedSentryApp.uuid,
          },
          status: 'pending',
        });

        Client.addMockResponse({
          url: `/organizations/${org.slug}/sentry-apps/`,
          body: [installedSentryApp],
        });

        Client.addMockResponse({
          url: '/sentry-apps/',
          body: [installedSentryApp],
        });

        Client.addMockResponse({
          url: `/organizations/${org.slug}/sentry-app-installations/`,
          body: [sentryAppInstall],
        });

        wrapper = mountWithTheme(
          <OrganizationIntegrations organization={org} {...otherProps} />,
          routerContext
        );
        const pending = wrapper.find('SentryAppInstallationDetail').at(0);
        expect(pending.find('StatusIndicator').prop('status')).toBe('Pending');
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

        const internalAppInstall = TestStubs.SentryAppInstallation({
          organization: {
            slug: org.slug,
          },
          app: {
            slug: internalApp.slug,
            uuid: internalApp.uuid,
          },
        });

        Client.addMockResponse({
          url: `/organizations/${org.slug}/sentry-app-installations/`,
          body: [internalAppInstall],
        });

        wrapper = mountWithTheme(
          <OrganizationIntegrations organization={org} {...otherProps} />,
          routerContext
        );
        expect(
          wrapper.find('Panel [data-test-id="internal-integration-row"]').exists()
        ).toBe(true);
        const appRow = wrapper.find('SentryApplicationRow').at(0);
        expect(appRow.find('StatusIndicator').prop('status')).toBe('Installed');
      });

      it('removes an internal app', async function() {
        const internalApp = {...sentryApp, status: 'internal'};
        Client.addMockResponse({
          url: `/organizations/${org.slug}/sentry-apps/`,
          body: [internalApp],
        });
        Client.addMockResponse({
          url: '/sentry-apps/',
          body: [],
        });
        Client.addMockResponse({
          url: `/sentry-apps/${internalApp.slug}/`,
          method: 'DELETE',
          statusCode: 200,
        });

        wrapper = mountWithTheme(
          <OrganizationIntegrations organization={org} {...otherProps} />,
          routerContext
        );
        wrapper.instance().handleRemoveInternalSentryApp(internalApp);
        await tick();
        wrapper.update();
        expect(wrapper.instance().state.orgOwnedApps).toHaveLength(0);
      });
    });

    describe('with installed integrations', () => {
      let updatedIntegration;

      beforeEach(() => {
        Client.addMockResponse({
          url: `/organizations/${org.slug}/integrations/`,
          body: [githubIntegration, jiraIntegration],
        });

        wrapper = mountWithTheme(
          <OrganizationIntegrations organization={org} {...otherProps} />,
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

        wrapper = mountWithTheme(
          <OrganizationIntegrations organization={org} {...otherProps} />,
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
        ).toBe('IconAddAdd Another');
      });

      it('display an Install button when its not an upgradable Integration', () => {
        expect(
          wrapper
            .find('ProviderRow PanelItem[data-test-id="jira"] Button')
            .first()
            .text()
        ).toBe('IconAddInstall');
      });
    });
  });
  describe('extra_app query parameter defined', () => {
    it('loads and renders extraApp', () => {
      const appSlug = 'app2';
      const extraApp = {
        ...sentryApp,
        status: 'unpublished',
        slug: appSlug,
        name: 'another app',
        owner: {
          id: 43,
          slug: 'another',
        },
      };

      otherProps.location.search = `?extra_app=${appSlug}`;
      const loadExtraApp = Client.addMockResponse({
        url: `/sentry-apps/${appSlug}/`,
        body: extraApp,
      });

      wrapper = mountWithTheme(
        <OrganizationIntegrations organization={org} {...otherProps} />,
        routerContext
      );
      expect(loadExtraApp).toHaveBeenCalled();
      expect(wrapper.find('SentryAppName').text()).toMatch('another app');
    });
  });
});
