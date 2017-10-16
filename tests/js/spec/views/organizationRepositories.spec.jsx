import React from 'react';
import {mount, shallow} from 'enzyme';

import {Client} from 'app/api';
import OrganizationRepositories from 'app/views/organizationRepositories';

const childContextTypes = {
  organization: React.PropTypes.object,
  location: React.PropTypes.object
};

describe('OrganizationRepositories', function() {
  beforeEach(function() {
    Client.clearMockResponses();
  });

  describe('render()', function() {
    describe('without any providers', function() {
      beforeEach(function() {
        Client.addMockResponse({
          url: '/organizations/org-slug/repos/',
          body: []
        });
        Client.addMockResponse({
          url: '/organizations/org-slug/config/repos/',
          body: {providers: []}
        });
      });

      it('is loading when initially rendering', function() {
        let wrapper = shallow(<OrganizationRepositories params={{orgId: 'org-slug'}} />, {
          context: {
            router: TestStubs.router(),
            organization: TestStubs.Organization(),
            location: TestStubs.location()
          },
          childContextTypes
        });
        expect(wrapper).toMatchSnapshot();
      });

      it('renders', function() {
        let wrapper = mount(<OrganizationRepositories params={{orgId: 'org-slug'}} />, {
          context: {
            router: TestStubs.router(),
            organization: TestStubs.Organization(),
            location: TestStubs.location()
          },
          childContextTypes
        });
        expect(wrapper.state('loading')).toBe(false);
        expect(wrapper).toMatchSnapshot();
      });
    });

    describe('with a provider', function() {
      beforeEach(function() {
        Client.addMockResponse({
          url: '/organizations/org-slug/config/repos/',
          body: {providers: [TestStubs.GitHubRepositoryProvider()]}
        });
      });
      it('renders', function() {
        Client.addMockResponse({
          url: '/organizations/org-slug/repos/',
          body: []
        });
        let wrapper = mount(<OrganizationRepositories params={{orgId: 'org-slug'}} />, {
          context: {
            router: TestStubs.router(),
            organization: TestStubs.Organization(),
            location: TestStubs.location()
          },
          childContextTypes
        });
        expect(wrapper.state('loading')).toBe(false);
        expect(wrapper).toMatchSnapshot();
      });
      it('renders with a repository', function() {
        Client.addMockResponse({
          url: '/organizations/org-slug/repos/',
          body: [TestStubs.Repository()]
        });
        let wrapper = mount(<OrganizationRepositories params={{orgId: 'org-slug'}} />, {
          context: {
            router: TestStubs.router(),
            organization: TestStubs.Organization(),
            location: TestStubs.location()
          },
          childContextTypes
        });
        expect(wrapper.state('loading')).toBe(false);
        expect(wrapper).toMatchSnapshot();
      });
    });
  });
});
