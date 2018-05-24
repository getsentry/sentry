/*global global*/
import React from 'react';
import {mount, shallow} from 'enzyme';

import OrganizationIntegration from 'app/views/organizationIntegration';
import {Client} from 'app/api';

describe('OrganizationIntegration', function() {
  beforeEach(function() {
    Client.clearMockResponses();
  });

  describe('render()', function() {
    const org = TestStubs.Organization();
    const project = TestStubs.Project();
    const provider = TestStubs.GitHubIntegrationProvider();
    const integration = TestStubs.GitHubIntegration();
    const params = {
      orgId: org.slug,
      projectId: project.slug,
      providerKey: provider.key,
    };
    const routerContext = TestStubs.routerContext();

    describe('without any integrations', function() {
      beforeEach(function() {
        Client.addMockResponse({
          url: `/organizations/${org.slug}/integrations/?provider_key=${provider.key}`,
          body: [],
        });
        Client.addMockResponse({
          url: `/organizations/${org.slug}/config/integrations/`,
          body: {providers: [provider]},
        });
      });

      it('Displays an empty list', function() {
        const wrapper = shallow(
          <OrganizationIntegration params={params} />,
          routerContext
        );
        expect(wrapper.find('PanelBody EmptyMessage').exists()).toBe(true);
      });

      it('Displays an error for an invalid provider key', function() {
        Client.addMockResponse({
          url: `/organizations/${org.slug}/integrations/?provider_key=bad-key`,
          body: [],
        });
        const invalidKeyParams = {...params, providerKey: 'bad-key'};
        const wrapper = shallow(
          <OrganizationIntegration params={invalidKeyParams} />,
          routerContext
        );
        expect(wrapper).toMatchSnapshot();
      });
    });

    describe('with one integration', function() {
      beforeEach(function() {
        Client.addMockResponse({
          url: `/organizations/${org.slug}/integrations/?provider_key=${provider.key}`,
          body: [integration],
        });
        Client.addMockResponse({
          url: `/organizations/${org.slug}/config/integrations/`,
          body: {providers: [provider]},
        });
      });

      it('renders', function() {
        const wrapper = shallow(
          <OrganizationIntegration params={params} />,
          routerContext
        );
        expect(wrapper).toMatchSnapshot();
      });

      it('opens a dialog on integration add', function() {
        const wrapper = mount(<OrganizationIntegration params={params} />, routerContext);

        const focus = jest.fn();
        const open = jest.fn().mockReturnValue({focus});
        global.open = open;

        wrapper.find('PanelHeader Button').simulate('click');
        expect(open.mock.calls).toHaveLength(1);
        expect(focus.mock.calls).toHaveLength(1);
        expect(open.mock.calls[0][2]).toBe(
          'scrollbars=yes,width=100,height=100,top=334,left=462'
        );
      });

      it('Adds an integration on dialog completion', function() {
        const wrapper = mount(<OrganizationIntegration params={params} />, routerContext);

        wrapper.instance().receiveMessage({
          source: null,
          origin: 'null',
          data: {
            success: true,
            data: Object.assign({}, integration, {
              id: '2',
              domain_name: 'new-integration.github.com',
              icon: 'http://example.com/new-integration-icon.png',
              name: 'New Integration',
            }),
          },
        });

        expect(wrapper.instance().state.integrations).toHaveLength(2);
      });

      it('Merges existing integrations', function() {
        const wrapper = mount(<OrganizationIntegration params={params} />, routerContext);

        const updatedIntegration = Object.assign({}, integration, {
          id: '1',
          domain_name: 'updated-integration.github.com',
          icon: 'http://example.com/updated-integration-icon.png',
          name: 'Updated Integration',
        });

        wrapper.instance().receiveMessage({
          source: null,
          origin: 'null',
          data: {
            success: true,
            data: updatedIntegration,
          },
        });

        expect(wrapper.instance().state.integrations).toHaveLength(1);
        expect(wrapper.instance().state.integrations[0]).toBe(updatedIntegration);
      });

      it('Deletes an integration', function() {
        const wrapper = mount(<OrganizationIntegration params={params} />, routerContext);

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
