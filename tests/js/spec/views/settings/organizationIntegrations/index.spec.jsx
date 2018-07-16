/*global global*/
import React from 'react';

import {Client} from 'app/api';
import {shallow} from 'enzyme';
import {openIntegrationDetails} from 'app/actionCreators/modal';
import OrganizationIntegrations from 'app/views/organizationIntegrations';

jest.mock('app/actionCreators/modal', () => ({
  openIntegrationDetails: jest.fn(),
}));

describe('OrganizationIntegrations', function() {
  beforeEach(function() {
    Client.clearMockResponses();
  });

  describe('render()', function() {
    const org = TestStubs.Organization();

    const githubProvider = TestStubs.GitHubIntegrationProvider();
    const jiraProvider = TestStubs.JiraIntegrationProvider();

    const githubIntegration = TestStubs.GitHubIntegration();
    const jiraIntegration = TestStubs.JiraIntegration();

    const params = {
      orgId: org.slug,
    };

    const routerContext = TestStubs.routerContext();

    describe('without integrations', function() {
      Client.addMockResponse({
        url: `/organizations/${org.slug}/integrations/`,
        body: [],
      });
      Client.addMockResponse({
        url: `/organizations/${org.slug}/config/integrations/`,
        body: {providers: [githubProvider, jiraProvider]},
      });

      const wrapper = shallow(
        <OrganizationIntegrations params={params} />,
        routerContext
      );

      it('Displays integration providers', function() {
        expect(wrapper).toMatchSnapshot();
      });

      it('Opens the integration dialog on install', function() {
        const options = {
          provider: githubProvider,
          onAddIntegration: wrapper.instance().mergeIntegration,
        };

        wrapper
          .find('PanelItem Button')
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

      const wrapper = shallow(
        <OrganizationIntegrations params={params} />,
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
        wrapper.instance().mergeIntegration(updatedIntegration);

        expect(wrapper.instance().state.integrations).toHaveLength(2);
        expect(wrapper.instance().state.integrations[1]).toBe(updatedIntegration);
      });

      it('Deletes an integration', function() {
        Client.addMockResponse({
          url: `/organizations/${org.slug}/integrations/${jiraIntegration.id}/`,
          method: 'DELETE',
          statusCode: 200,
        });

        wrapper.instance().handleDeleteIntegration(jiraIntegration);

        expect(wrapper.instance().state.integrations).toHaveLength(1);
        expect(wrapper.instance().state.integrations[0]).toBe(updatedIntegration);
      });
    });
  });
});
