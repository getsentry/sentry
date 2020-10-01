import React from 'react';

import {mountWithTheme} from 'sentry-test/enzyme';

import OrganizationMemberRow from 'app/views/settings/organizationMembers/organizationMemberRow';

describe('OrganizationMemberRow', function () {
  const member = {
    id: '1',
    email: '',
    name: '',
    role: 'member',
    roleName: 'Member',
    pending: false,
    flags: {
      'sso:linked': false,
    },
    user: {
      id: '',
      has2fa: false,
      name: 'sentry@test.com',
    },
  };

  const currentUser = {
    id: '2',
    email: 'currentUser@email.com',
  };

  const defaultProps = {
    routes: [],
    orgId: 'org-slug',
    orgName: 'Organization Name',
    status: '',
    requireLink: false,
    memberCanLeave: false,
    canAddMembers: false,
    canRemoveMembers: false,
    member,
    currentUser,
    onSendInvite: () => {},
    onRemove: () => {},
    onLeave: () => {},
  };

  const resendButton = 'StyledButton[aria-label="Resend invite"]';
  const resendSsoButton = 'StyledButton[aria-label="Resend SSO link"]';
  const leaveButton = 'StyledButton[aria-label="Leave"]';
  const removeButton = 'StyledButton[aria-label="Remove"]';

  beforeEach(function () {});

  it('does not have 2fa warning if user has 2fa', function () {
    const wrapper = mountWithTheme(
      <OrganizationMemberRow
        {...defaultProps}
        member={{
          ...member,
          user: {
            ...member.user,
            has2fa: true,
          },
        }}
      />
    );
    expect(wrapper.find('IconCheckmark')).toHaveLength(1);
    expect(wrapper.find('IconFlag')).toHaveLength(0);
  });

  it('has 2fa warning if user does not have 2fa enabled', function () {
    const wrapper = mountWithTheme(
      <OrganizationMemberRow
        {...defaultProps}
        member={{
          ...member,
          user: {
            ...member.user,
            has2fa: false,
          },
        }}
      />
    );
    expect(wrapper.find('IconCheckmark')).toHaveLength(0);
    expect(wrapper.find('IconFlag')).toHaveLength(1);
  });

  describe('Pending user', function () {
    const props = {
      ...defaultProps,
      member: {
        ...member,
        pending: true,
      },
    };

    it('has "Invited" status, no "Resend Invite"', function () {
      const wrapper = mountWithTheme(
        <OrganizationMemberRow
          {...props}
          member={{
            ...member,
            pending: true,
          }}
        />
      );

      expect(wrapper.find('[data-test-id="member-role"]').text()).toBe('Invited Member');
      expect(wrapper.find(resendButton).prop('disabled')).toBe(true);
    });

    it('has "Resend Invite" button only if `canAddMembers` is true', function () {
      const wrapper = mountWithTheme(<OrganizationMemberRow {...props} canAddMembers />);

      expect(wrapper.find('[data-test-id="member-role"]').text()).toBe('Invited Member');
      expect(wrapper.find(resendButton).prop('disabled')).toBe(false);
    });

    it('has the right inviting states', function () {
      let wrapper = mountWithTheme(<OrganizationMemberRow {...props} canAddMembers />);

      expect(wrapper.find(resendButton).exists()).toBe(true);

      wrapper = mountWithTheme(
        <OrganizationMemberRow {...props} canAddMembers status="loading" />
      );

      // Should have loader
      expect(wrapper.find('LoadingIndicator')).toHaveLength(1);
      // No Resend Invite button
      expect(wrapper.find(resendButton).exists()).toBe(false);

      wrapper = mountWithTheme(
        <OrganizationMemberRow {...props} canAddMembers status="success" />
      );

      // Should have loader
      expect(wrapper.find('LoadingIndicator')).toHaveLength(0);
      // No Resend Invite button
      expect(wrapper.find(resendButton).exists()).toBe(false);
      expect(wrapper.find('[data-test-id="member-status"]').text()).toBe('Sent!');
    });
  });

  describe('Expired user', function () {
    it('has "Expired" status', function () {
      const wrapper = mountWithTheme(
        <OrganizationMemberRow
          {...defaultProps}
          canAddMembers
          member={{
            ...member,
            pending: true,
            expired: true,
          }}
        />
      );

      expect(wrapper.find('[data-test-id="member-role"]').text()).toBe('Expired Invite');
      expect(wrapper.find(resendButton).prop('disabled')).toBe(false);
    });
  });

  describe('Requires SSO Link', function () {
    const props = {
      ...defaultProps,
      flags: {
        'sso:link': false,
      },
      requireLink: true,
    };

    it('shows "Invited" status if user has not registered and not linked', function () {
      const wrapper = mountWithTheme(
        <OrganizationMemberRow
          {...props}
          canAddMembers
          member={{
            ...member,
            pending: true,
          }}
        />
      );

      expect(wrapper.find('[data-test-id="member-role"]').text()).toBe('Invited Member');
      expect(wrapper.find(resendButton).prop('disabled')).toBe(false);
    });

    it('shows "missing SSO link" message if user is registered and needs link', function () {
      const wrapper = mountWithTheme(
        <OrganizationMemberRow
          {...props}
          member={{
            ...member,
          }}
        />
      );

      expect(wrapper.find('[data-test-id="member-role"]').text()).toBe('Member');
      expect(wrapper.find(resendSsoButton).prop('disabled')).toBe(true);
    });

    it('has "Resend SSO link" button only if `canAddMembers` is true and no link', function () {
      const wrapper = mountWithTheme(
        <OrganizationMemberRow
          {...props}
          canAddMembers
          member={{
            ...member,
          }}
        />
      );

      expect(wrapper.find(resendSsoButton).prop('disabled')).toBe(false);
    });

    it('has 2fa warning if user is linked does not have 2fa enabled', function () {
      const wrapper = mountWithTheme(
        <OrganizationMemberRow
          {...defaultProps}
          member={{
            ...member,
            flags: {
              'sso:linked': true,
            },
            user: {
              ...member.user,
              has2fa: false,
            },
          }}
        />
      );

      expect(wrapper.find('IconCheckmark')).toHaveLength(0);
      expect(wrapper.find('IconFlag')).toHaveLength(1);
    });
  });

  describe('Is Current User', function () {
    const props = {
      ...defaultProps,
      member: {
        ...member,
        email: 'currentUser@email.com',
      },
    };

    it('has button to leave organization and no button to remove', function () {
      const wrapper = mountWithTheme(<OrganizationMemberRow {...props} memberCanLeave />);

      expect(wrapper.find(leaveButton).exists()).toBe(true);
      expect(wrapper.find(removeButton).exists()).toBe(false);
    });

    it('has disabled button to leave organization and no button to remove when member can not leave', function () {
      const wrapper = mountWithTheme(
        <OrganizationMemberRow {...props} memberCanLeave={false} />
      );

      expect(wrapper.find(leaveButton).prop('disabled')).toBe(true);
      expect(wrapper.find(removeButton).exists()).toBe(false);
    });
  });

  describe('Not Current User', function () {
    const props = {
      ...defaultProps,
    };

    it('does not have Leave button', function () {
      const wrapper = mountWithTheme(<OrganizationMemberRow {...props} memberCanLeave />);

      expect(wrapper.find(leaveButton).exists()).toBe(false);
    });

    it('has Remove disabled button when `canRemoveMembers` is false', function () {
      const wrapper = mountWithTheme(<OrganizationMemberRow {...props} />);

      expect(wrapper.find(removeButton).prop('disabled')).toBe(true);
    });

    it('has Remove button when `canRemoveMembers` is true', function () {
      const wrapper = mountWithTheme(
        <OrganizationMemberRow {...props} canRemoveMembers />
      );

      expect(wrapper.find(removeButton).prop('disabled')).toBe(false);
    });
  });
});
