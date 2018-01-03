import PropTypes from 'prop-types';
import React from 'react';

import {Client} from 'app/api';
import {mount} from 'enzyme';
import ConfigStore from 'app/stores/configStore';
import OrganizationMembersView from 'app/views/settings/organization/members/organizationMembersView';

jest.mock('app/api');

describe('OrganizationMembersView', function() {
  let currentUser = TestStubs.Members()[1];
  let defaultProps = {
    orgId: 'org-slug',
    orgName: 'Organization Name',
    status: '',
    routes: [],
    requireLink: false,
    memberCanLeave: false,
    canAddMembers: false,
    canRemoveMembers: false,
    currentUser,
    onSendInvite: () => {},
    onRemove: () => {},
    onLeave: () => {},
  };

  beforeAll(function() {
    sinon.stub(ConfigStore, 'get', () => currentUser);
  });

  afterAll(function() {
    ConfigStore.get.restore();
  });

  beforeEach(function() {
    Client.clearMockResponses();
    Client.addMockResponse({
      url: '/organizations/org-id/members/',
      method: 'GET',
      body: TestStubs.Members(),
    });
    Client.addMockResponse({
      url: '/organizations/org-id/access-requests/',
      method: 'GET',
      body: [],
    });
  });

  describe('Require Link', function() {
    beforeEach(function() {
      Client.addMockResponse({
        url: '/organizations/org-id/auth-provider/',
        method: 'GET',
        body: {
          ...TestStubs.AuthProvider(),
          require_link: true,
        },
      });
    });

    it('does not have 2fa warning if user has 2fa', function() {
      let wrapper = mount(
        <OrganizationMembersView
          {...defaultProps}
          params={{
            orgId: 'org-id',
          }}
        />,
        {
          childContextTypes: {
            router: PropTypes.object,
          },
          context: {
            organization: TestStubs.Organization(),
            router: TestStubs.router(),
          },
        }
      );

      expect(wrapper).toMatchSnapshot();
    });
  });

  describe('No Require Link', function() {
    beforeEach(function() {
      Client.addMockResponse({
        url: '/organizations/org-id/auth-provider/',
        method: 'GET',
        body: {
          ...TestStubs.AuthProvider(),
          require_link: false,
        },
      });
    });

    it('does not have 2fa warning if user has 2fa', function() {
      let wrapper = mount(
        <OrganizationMembersView
          {...defaultProps}
          params={{
            orgId: 'org-id',
          }}
        />,
        {
          childContextTypes: {
            router: PropTypes.object,
          },
          context: {
            organization: TestStubs.Organization(),
            router: TestStubs.router(),
          },
        }
      );

      expect(wrapper).toMatchSnapshot();
    });
  });
});
