import PropTypes from 'prop-types';
import React from 'react';
import {mount, shallow} from 'enzyme';

import {Client} from 'app/api';
import OrganizationIntegrations from 'app/views/organizationIntegrations';

const childContextTypes = {
  organization: PropTypes.object,
  location: PropTypes.object,
};

describe('OrganizationIntegrations', function() {
  beforeEach(function() {
    Client.clearMockResponses();
  });

  describe('render()', function() {
    describe('without any providers', function() {
      beforeEach(function() {
        Client.addMockResponse({
          url: '/organizations/org-slug/integrations/',
          body: [],
        });
        Client.addMockResponse({
          url: '/organizations/org-slug/config/integrations/',
          body: {providers: []},
        });
      });

      it('is loading when initially rendering', function() {
        let wrapper = shallow(<OrganizationIntegrations params={{orgId: 'org-slug'}} />, {
          context: {
            router: TestStubs.router(),
            organization: TestStubs.Organization(),
            location: TestStubs.location(),
          },
          childContextTypes,
        });
        expect(wrapper).toMatchSnapshot();
      });

      it('renders', function() {
        let wrapper = mount(<OrganizationIntegrations params={{orgId: 'org-slug'}} />, {
          context: {
            router: TestStubs.router(),
            organization: TestStubs.Organization(),
            location: TestStubs.location(),
          },
          childContextTypes,
        });
        wrapper.find('.dropdown-actor').simulate('click');
        expect(wrapper.state('loading')).toBe(false);
        expect(wrapper).toMatchSnapshot();
      });
    });

    describe('with a provider', function() {
      beforeEach(function() {
        Client.addMockResponse({
          url: '/organizations/org-slug/config/integrations/',
          body: {providers: [TestStubs.GitHubIntegrationProvider()]},
        });
      });

      it('renders', function() {
        Client.addMockResponse({
          url: '/organizations/org-slug/integrations/',
          body: [],
        });
        let wrapper = mount(<OrganizationIntegrations params={{orgId: 'org-slug'}} />, {
          context: {
            router: TestStubs.router(),
            organization: TestStubs.Organization(),
            location: TestStubs.location(),
          },
          childContextTypes,
        });
        wrapper.find('.dropdown-actor').simulate('click');
        expect(wrapper.state('loading')).toBe(false);
        expect(wrapper).toMatchSnapshot();
      });

      it('renders with a repository', function() {
        Client.addMockResponse({
          url: '/organizations/org-slug/integrations/',
          body: [TestStubs.Integration()],
        });
        let wrapper = mount(<OrganizationIntegrations params={{orgId: 'org-slug'}} />, {
          context: {
            router: TestStubs.router(),
            organization: TestStubs.Organization(),
            location: TestStubs.location(),
          },
          childContextTypes,
        });
        wrapper.find('.dropdown-actor').simulate('click');
        expect(wrapper.state('loading')).toBe(false);
        expect(wrapper).toMatchSnapshot();
      });
    });
  });
});
