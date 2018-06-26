import React from 'react';
import {mount} from 'enzyme';

import {updateMember} from 'app/actionCreators/members';
import OrganizationMemberDetail from 'app/views/settings/organizationMembers/organizationMemberDetail';

jest.mock('app/actionCreators/members', () => ({
  updateMember: jest.fn().mockReturnValue(new Promise(() => {})),
}));

describe('OrganizationMemberDetail', function() {
  let organization;
  let wrapper;
  let routerContext;
  let team = TestStubs.Team();
  let teams = [
    team,
    TestStubs.Team({
      id: '2',
      slug: 'new-team',
      name: 'New Team',
      isMember: false,
    }),
  ];
  let member = TestStubs.Member({
    roles: TestStubs.RoleList(),
    dateCreated: new Date(),
    teams: [team.slug],
  });

  describe('Can Edit', function() {
    beforeAll(function() {
      organization = TestStubs.Organization({teams});
      routerContext = TestStubs.routerContext([{organization}]);
    });

    beforeEach(function() {
      MockApiClient.clearMockResponses();
      MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/members/${member.id}/`,
        body: member,
      });
    });

    it('changes role to owner', function() {
      wrapper = mount(
        <OrganizationMemberDetail params={{memberId: member.id}} />,
        routerContext
      );

      // Should have 4 roles
      expect(wrapper.find('RoleSelect Radio')).toHaveLength(4);

      wrapper
        .find('RoleSelect Radio')
        .last()
        .simulate('click');

      expect(
        wrapper
          .find('RoleSelect Radio')
          .last()
          .prop('checked')
      ).toBe(true);

      // Save Member
      wrapper.find('Button[priority="primary"]').simulate('click');

      expect(updateMember).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          data: expect.objectContaining({
            role: 'owner',
          }),
        })
      );
    });

    it('joins a team', function() {
      wrapper = mount(
        <OrganizationMemberDetail params={{memberId: member.id}} />,
        routerContext
      );

      expect(
        wrapper
          .find('TeamSelect Checkbox')
          .first()
          .prop('checked')
      ).toBe(true);
      expect(
        wrapper
          .find('TeamSelect Checkbox')
          .last()
          .prop('checked')
      ).toBe(false);

      // Select new team to join
      wrapper
        .find('TeamSelect Checkbox')
        .last()
        .simulate('change');

      expect(
        wrapper
          .find('TeamSelect Checkbox')
          .last()
          .prop('checked')
      ).toBe(true);

      // Save Member
      wrapper.find('Button[priority="primary"]').simulate('click');

      expect(updateMember).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          data: expect.objectContaining({
            teams: ['team-slug', 'new-team'],
          }),
        })
      );
    });
  });

  describe('Cannot Edit', function() {
    beforeAll(function() {
      organization = TestStubs.Organization({teams, access: ['org:read']});
      routerContext = TestStubs.routerContext([{organization}]);
    });

    it('can not change roles, teams, or save', function() {
      wrapper = mount(
        <OrganizationMemberDetail params={{memberId: member.id}} />,
        routerContext
      );

      // Should have 4 roles
      expect(wrapper.find('RoleSelect').prop('disabled')).toBe(true);
      expect(wrapper.find('TeamSelect').prop('disabled')).toBe(true);
      expect(wrapper.find('Button').prop('disabled')).toBe(true);
    });
  });
});
