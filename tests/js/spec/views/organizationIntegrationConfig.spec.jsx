/*global global*/
import React from 'react';
import {mount, shallow} from 'enzyme';

import OrganizationIntegrationConfig from 'app/views/organizationIntegrationConfig';
import {Client} from 'app/api';

describe('OrganizationIntegrationConfig', function() {
  beforeEach(function() {
    Client.clearMockResponses();
  });

  describe('render()', function() {
    const org = TestStubs.Organization();
    const provider = TestStubs.GitHubIntegrationProvider();
    const integration = TestStubs.GitHubIntegration();
    const params = {
      orgId: org.slug,
      providerKey: provider.key,
    };
    const routerContext = TestStubs.routerContext();

    describe('without any integrations', function() {
      beforeEach(function() {
        Client.addMockResponse({
          url: `/organizations/${org.slug}/integrations/`,
          body: [],
        });
        Client.addMockResponse({
          url: `/organizations/${org.slug}/config/integrations/`,
          body: {providers: [provider]},
        });
      });

      it('Displays an empty list', function() {
        const wrapper = shallow(
          <OrganizationIntegrationConfig params={params} />,
          routerContext
        );
        expect(wrapper.find('PanelBody EmptyMessage').exists()).toBe(true);
      });

      it('Displays an error for an invalid provider key', function() {
        const invalidKeyParams = {...params, providerKey: 'bad-key'};
        const wrapper = shallow(
          <OrganizationIntegrationConfig params={invalidKeyParams} />,
          routerContext
        );
        expect(wrapper).toMatchSnapshot();
      });
    });

    describe('with one integration', function() {
      beforeEach(function() {
        Client.addMockResponse({
          url: `/organizations/${org.slug}/integrations/`,
          body: [integration],
        });
        Client.addMockResponse({
          url: `/organizations/${org.slug}/config/integrations/`,
          body: {providers: [provider]},
        });
      });

      it('renders', function() {
        const wrapper = mount(
          <OrganizationIntegrationConfig params={params} />,
          routerContext
        );
        expect(wrapper).toMatchSnapshot();
      });

      it('opens a dialog on integration add', function() {
        const wrapper = mount(
          <OrganizationIntegrationConfig params={params} />,
          routerContext
        );

        const focus = jest.fn();
        const open = jest.fn().mockReturnValue({focus});
        global.open = open;

        wrapper.find('PanelHeader Button').simulate('click');
        expect(open.mock.calls.length).toBe(1);
        expect(focus.mock.calls.length).toBe(1);
        expect(open.mock.calls[0][2]).toBe(
          'scrollbars=yes,width=100,height=100,top=334,left=462'
        );
      });

      it('Adds an integration on dialog completion', function() {
        const wrapper = mount(
          <OrganizationIntegrationConfig params={params} />,
          routerContext
        );

        wrapper.instance().receiveMessage({
          source: null,
          origin: 'null',
          data: {
            success: true,
            data: {
              id: '2',
              domain_name: 'new-integration.github.com',
              icon: 'http://example.com/new-integration-icon.png',
              name: 'New Integration',
              provider: integration.provider,
            },
          },
        });

        expect(wrapper.instance().state.itemList.length).toBe(2);
      });

      it('Merges existing integrations', function() {
        const wrapper = mount(
          <OrganizationIntegrationConfig params={params} />,
          routerContext
        );

        const updatedIntegration = {
          id: '1',
          domain_name: 'updated-integration.github.com',
          icon: 'http://example.com/updated-integration-icon.png',
          name: 'Updated Integration',
          provider: integration.provider,
        };

        wrapper.instance().receiveMessage({
          source: null,
          origin: 'null',
          data: {
            success: true,
            data: updatedIntegration,
          },
        });

        expect(wrapper.instance().state.itemList.length).toBe(1);
        expect(wrapper.instance().state.itemList[0]).toBe(updatedIntegration);
      });

      it('Deletes an integration', function() {
        const wrapper = mount(
          <OrganizationIntegrationConfig params={params} />,
          routerContext
        );

        Client.addMockResponse({
          url: `/organizations/${org.slug}/integrations/${integration.id}/`,
          method: 'DELETE',
          statusCode: 200,
        });

        wrapper.find('PanelBody Button').simulate('click');
        wrapper.find('PanelBody Modal Button[priority="primary"]').simulate('click');

        expect(wrapper.find('PanelBody EmptyMessage').exists()).toBe(true);
      });
    });
  });
});
