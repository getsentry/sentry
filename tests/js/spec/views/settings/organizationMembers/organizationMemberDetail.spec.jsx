import {mountWithTheme} from 'sentry-test/enzyme';

import {updateMember} from 'app/actionCreators/members';
import OrganizationMemberDetail from 'app/views/settings/organizationMembers/organizationMemberDetail';

jest.mock('app/actionCreators/members', () => ({
  updateMember: jest.fn().mockReturnValue(new Promise(() => {})),
}));

describe('OrganizationMemberDetail', function () {
  let organization;
  let wrapper;
  let routerContext;
  const team = TestStubs.Team();
  const teams = [
    team,
    TestStubs.Team({
      id: '2',
      slug: 'new-team',
      name: 'New Team',
      isMember: false,
    }),
  ];
  const member = TestStubs.Member({
    roles: TestStubs.RoleList(),
    dateCreated: new Date(),
    teams: [team.slug],
  });
  const pendingMember = TestStubs.Member({
    id: 2,
    roles: TestStubs.RoleList(),
    dateCreated: new Date(),
    teams: [team.slug],
    invite_link: 'http://example.com/i/abc123',
    pending: true,
  });
  const expiredMember = TestStubs.Member({
    id: 3,
    roles: TestStubs.RoleList(),
    dateCreated: new Date(),
    teams: [team.slug],
    invite_link: 'http://example.com/i/abc123',
    pending: true,
    expired: true,
  });

  describe('Can Edit', function () {
    beforeAll(function () {
      organization = TestStubs.Organization({teams});
      routerContext = TestStubs.routerContext([{organization}]);
    });

    beforeEach(function () {
      MockApiClient.clearMockResponses();
      MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/members/${member.id}/`,
        body: member,
      });
      MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/members/${pendingMember.id}/`,
        body: pendingMember,
      });
      MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/members/${expiredMember.id}/`,
        body: expiredMember,
      });
      MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/teams/`,
        body: teams,
      });
    });

    it('changes role to owner', function () {
      wrapper = mountWithTheme(
        <OrganizationMemberDetail params={{memberId: member.id}} />,
        routerContext
      );

      // Should have 4 roles
      expect(wrapper.find('RoleSelect Radio')).toHaveLength(4);

      wrapper.find('RoleSelect Radio').last().simulate('click');

      expect(wrapper.find('RoleSelect Radio').last().prop('checked')).toBe(true);

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

    it('leaves a team', async function () {
      wrapper = mountWithTheme(
        <OrganizationMemberDetail params={{memberId: member.id}} />,
        routerContext
      );
      // Wait for team list to load
      await tick();

      // Remove our one team
      const button = wrapper.find('TeamSelect TeamRow Button');
      expect(button).toHaveLength(1);
      button.simulate('click');

      // Save Member
      wrapper.find('Button[priority="primary"]').simulate('click');

      expect(updateMember).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          data: expect.objectContaining({
            teams: [],
          }),
        })
      );
    });

    it('joins a team', async function () {
      wrapper = mountWithTheme(
        <OrganizationMemberDetail params={{memberId: member.id}} />,
        routerContext
      );
      // Wait for team list to fetch.
      await wrapper.update();

      // Should have one team enabled
      expect(wrapper.find('TeamPanelItem')).toHaveLength(1);

      // Select new team to join
      // Open the dropdown
      wrapper.find('TeamSelect DropdownButton').simulate('click');

      // Click the first item
      wrapper.find('TeamSelect TeamDropdownElement').first().simulate('click');

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

  describe('Cannot Edit', function () {
    beforeAll(function () {
      organization = TestStubs.Organization({teams, access: ['org:read']});
      routerContext = TestStubs.routerContext([{organization}]);
    });

    it('can not change roles, teams, or save', async function () {
      wrapper = mountWithTheme(
        <OrganizationMemberDetail params={{memberId: member.id}} />,
        routerContext
      );
      await wrapper.update();

      // Should have 4 roles
      expect(wrapper.find('RoleSelect').prop('disabled')).toBe(true);
      expect(wrapper.find('TeamSelect').prop('disabled')).toBe(true);
      expect(wrapper.find('TeamRow Button').first().prop('disabled')).toBe(true);

      // Save Member
      expect(wrapper.find('Button[priority="primary"]').prop('disabled')).toBe(true);
    });
  });

  describe('Display status', function () {
    beforeAll(function () {
      organization = TestStubs.Organization({teams, access: ['org:read']});
      routerContext = TestStubs.routerContext([{organization}]);
    });

    it('display pending status', function () {
      wrapper = mountWithTheme(
        <OrganizationMemberDetail params={{memberId: pendingMember.id}} />,
        routerContext
      );

      expect(wrapper.find('[data-test-id="member-status"]').text()).toEqual(
        'Invitation Pending'
      );
    });

    it('display expired status', function () {
      wrapper = mountWithTheme(
        <OrganizationMemberDetail params={{memberId: expiredMember.id}} />,
        routerContext
      );

      expect(wrapper.find('[data-test-id="member-status"]').text()).toEqual(
        'Invitation Expired'
      );
    });
  });

  describe('Show resend button', function () {
    beforeAll(function () {
      organization = TestStubs.Organization({teams, access: ['org:read']});
      routerContext = TestStubs.routerContext([{organization}]);
    });

    it('shows for pending', function () {
      wrapper = mountWithTheme(
        <OrganizationMemberDetail params={{memberId: pendingMember.id}} />,
        routerContext
      );

      const button = wrapper.find('Button[data-test-id="resend-invite"]');
      expect(button.text()).toEqual('Resend Invite');
    });

    it('does not show for expired', function () {
      wrapper = mountWithTheme(
        <OrganizationMemberDetail params={{memberId: expiredMember.id}} />,
        routerContext
      );

      expect(wrapper.find('Button[data-test-id="resend-invite"]')).toHaveLength(0);
    });
  });

  describe('Reset member 2FA', function () {
    const fields = {
      roles: TestStubs.RoleList(),
      dateCreated: new Date(),
      teams: [team.slug],
    };

    const noAccess = TestStubs.Member({
      ...fields,
      id: '4',
      user: TestStubs.User({has2fa: false}),
    });

    const no2fa = TestStubs.Member({
      ...fields,
      id: '5',
      user: TestStubs.User({has2fa: false, authenticators: [], canReset2fa: true}),
    });

    const has2fa = TestStubs.Member({
      ...fields,
      id: '6',
      user: TestStubs.User({
        has2fa: true,
        authenticators: [
          TestStubs.Authenticators().Totp(),
          TestStubs.Authenticators().Sms(),
          TestStubs.Authenticators().U2f(),
        ],
        canReset2fa: true,
      }),
    });

    const multipleOrgs = TestStubs.Member({
      ...fields,
      id: '7',
      user: TestStubs.User({
        has2fa: true,
        authenticators: [TestStubs.Authenticators().Totp()],
        canReset2fa: false,
      }),
    });

    beforeAll(function () {
      organization = TestStubs.Organization({teams});
      routerContext = TestStubs.routerContext([{organization}]);

      MockApiClient.clearMockResponses();
      MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/members/${pendingMember.id}/`,
        body: pendingMember,
      });
      MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/members/${noAccess.id}/`,
        body: noAccess,
      });
      MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/members/${no2fa.id}/`,
        body: no2fa,
      });
      MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/members/${has2fa.id}/`,
        body: has2fa,
      });
      MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/members/${multipleOrgs.id}/`,
        body: multipleOrgs,
      });
      MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/teams/`,
        body: teams,
      });
    });

    const button = 'Button[data-test-id="reset-2fa"]';
    const tooltip = 'Tooltip[data-test-id="reset-2fa-tooltip"]';

    const expectButtonEnabled = () => {
      expect(wrapper.find(button).text()).toEqual('Reset two-factor authentication');
      expect(wrapper.find(button).prop('disabled')).toBe(false);

      expect(wrapper.find(tooltip).prop('title')).toEqual('');
      expect(wrapper.find(tooltip).prop('disabled')).toBe(true);
    };

    const expectButtonDisabled = title => {
      expect(wrapper.find(button).text()).toEqual('Reset two-factor authentication');
      expect(wrapper.find(button).prop('disabled')).toBe(true);

      expect(wrapper.find(tooltip).prop('title')).toEqual(title);
      expect(wrapper.find(tooltip).prop('disabled')).toBe(false);
    };

    it('does not show for pending member', function () {
      wrapper = mountWithTheme(
        <OrganizationMemberDetail params={{memberId: pendingMember.id}} />,
        routerContext
      );
      expect(wrapper.find(button)).toHaveLength(0);
    });

    it('shows tooltip for joined member without permission to edit', function () {
      wrapper = mountWithTheme(
        <OrganizationMemberDetail params={{memberId: noAccess.id}} />,
        routerContext
      );
      expectButtonDisabled('You do not have permission to perform this action');
    });

    it('shows tooltip for member without 2fa', function () {
      wrapper = mountWithTheme(
        <OrganizationMemberDetail params={{memberId: no2fa.id}} />,
        routerContext
      );
      expectButtonDisabled('Not enrolled in two-factor authentication');
    });

    it('can reset member 2FA', function () {
      const deleteMocks = has2fa.user.authenticators.map(auth =>
        MockApiClient.addMockResponse({
          url: `/users/${has2fa.user.id}/authenticators/${auth.id}/`,
          method: 'DELETE',
        })
      );

      wrapper = mountWithTheme(
        <OrganizationMemberDetail params={{memberId: has2fa.id}} />,
        routerContext
      );

      expectButtonEnabled();
      wrapper.find(button).simulate('click');
      wrapper.find('Button[data-test-id="confirm-button"]').simulate('click');
      deleteMocks.map(deleteMock => {
        expect(deleteMock).toHaveBeenCalled();
      });
    });

    it('shows tooltip for member in multiple orgs', function () {
      wrapper = mountWithTheme(
        <OrganizationMemberDetail params={{memberId: multipleOrgs.id}} />,
        routerContext
      );
      expectButtonDisabled('Cannot be reset since user is in more than one organization');
    });

    it('shows tooltip for member in 2FA required org', function () {
      organization.require2FA = true;
      MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/members/${has2fa.id}/`,
        body: has2fa,
      });

      wrapper = mountWithTheme(
        <OrganizationMemberDetail params={{memberId: has2fa.id}} />,
        routerContext
      );
      expectButtonDisabled(
        'Cannot be reset since two-factor is required for this organization'
      );
    });
  });
});
