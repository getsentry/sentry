/*global global*/
import React from 'react';

import {Client} from 'app/api';
import {mount} from 'enzyme';
import {openIntegrationDetails} from 'app/actionCreators/modal';
import {OrganizationIntegrations} from 'app/views/organizationIntegrations';

jest.mock('app/actionCreators/modal', () => ({
  openIntegrationDetails: jest.fn(),
}));

describe('OrganizationIntegrations', function() {
  beforeEach(function() {
    Client.clearMockResponses();
  });

  describe('render()', function() {
    const org = TestStubs.Organization();

    const githubProvider = TestStubs.GitHubIntegrationProvider({
      integrations: [],
      isInstalled: false,
    });
    const jiraProvider = TestStubs.JiraIntegrationProvider();
    const vstsProvider = TestStubs.VstsIntegrationProvider();

    const githubIntegration = TestStubs.GitHubIntegration();
    const jiraIntegration = TestStubs.JiraIntegration();

    const params = {
      orgId: org.slug,
    };

    const routerContext = TestStubs.routerContext();

    const focus = jest.fn();
    const open = jest.fn().mockReturnValue({focus});
    global.open = open;

    describe('without integrations', function() {
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

      const wrapper = mount(
        <OrganizationIntegrations organization={org} params={params} />,
        routerContext
      );

      it('Displays integration providers', function() {
        expect(wrapper).toMatchSnapshot();
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

        expect(openIntegrationDetails).toBeCalledWith(options);
      });
    });

    describe('with installed integrations', function() {
      Client.addMockResponse({
        url: `/organizations/${org.slug}/integrations/`,
        body: [githubIntegration, jiraIntegration],
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

      const wrapper = mount(
        <OrganizationIntegrations organization={org} params={params} />,
        routerContext
      );

      const updatedIntegration = Object.assign({}, githubIntegration, {
        domain_name: 'updated-integration.github.com',
        icon: 'http://example.com/updated-integration-icon.png',
        name: 'Updated Integration',
      });

      it('Displays InstalledIntegration', function() {
        expect(wrapper).toMatchSnapshot();
      });

      it('Merges installed integrations', function() {
        wrapper.instance().onInstall(updatedIntegration);

        expect(wrapper.instance().state.integrations).toHaveLength(2);
        expect(wrapper.instance().state.integrations[1]).toBe(updatedIntegration);
      });

      it('Deletes an integration', function() {
        Client.addMockResponse({
          url: `/organizations/${org.slug}/integrations/${jiraIntegration.id}/`,
          method: 'DELETE',
          statusCode: 200,
        });

        wrapper.instance().onRemove(jiraIntegration);

        expect(wrapper.instance().state.integrations).toHaveLength(1);
        expect(wrapper.instance().state.integrations[0]).toBe(updatedIntegration);
      });
    });

    describe('with matching plugins installed', function() {
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

      const wrapper = mount(
        <OrganizationIntegrations organization={org} params={params} />,
        routerContext
      );

      it('displays an Update when the Plugin is enabled but a new Integration is not', function() {
        expect(
          wrapper
            .find('ProviderRow')
            .filterWhere(n => n.key() === 'vsts')
            .find('Button')
            .first()
            .text()
        ).toBe('Update');
      });

      it('displays Add Another button when both Integration and Plugin are enabled', () => {
        expect(
          wrapper
            .find('ProviderRow')
            .filterWhere(n => n.key() === 'github')
            .find('Button')
            .first()
            .text()
        ).toBe('Add Another');
      });

      it('display an Install button when its not an upgradable Integration', () => {
        expect(
          wrapper
            .find('ProviderRow')
            .filterWhere(n => n.key() === 'jira')
            .find('Button')
            .first()
            .text()
        ).toBe('Install');
      });
    });
  });
});
