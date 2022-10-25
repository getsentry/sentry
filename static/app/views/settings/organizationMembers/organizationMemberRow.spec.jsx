import {render, screen} from 'sentry-test/reactTestingLibrary';

import OrganizationMemberRow from 'sentry/views/settings/organizationMembers/organizationMemberRow';

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

  function resendButton() {
    return screen.queryByRole('button', {name: 'Resend invite'});
  }

  function resendSsoButton() {
    return screen.queryByRole('button', {name: 'Resend SSO link'});
  }

  function leaveButton() {
    return screen.queryByRole('button', {name: 'Leave'});
  }

  function removeButton() {
    return screen.queryByRole('button', {name: 'Remove'});
  }

  describe('two factor', function () {
    it('does not have 2fa warning if user has 2fa', function () {
      render(
        <OrganizationMemberRow
          {...defaultProps}
          member={{
            ...member,
            user: {...member.user, has2fa: true},
          }}
        />
      );

      expect(screen.getByText('2FA Enabled')).toBeInTheDocument();
      expect(screen.queryByText('2FA Not Enabled')).not.toBeInTheDocument();
    });

    it('has 2fa warning if user does not have 2fa enabled', function () {
      render(
        <OrganizationMemberRow
          {...defaultProps}
          member={{
            ...member,
            user: {...member.user, has2fa: false},
          }}
        />
      );

      expect(screen.getByText('2FA Not Enabled')).toBeInTheDocument();
      expect(screen.queryByText('2FA Enabled')).not.toBeInTheDocument();
    });
  });

  describe('Pending user', function () {
    const props = {
      ...defaultProps,
      member: {...member, pending: true},
    };

    it('has "Invited" status, no "Resend Invite"', function () {
      render(<OrganizationMemberRow {...props} />);

      expect(screen.getByTestId('member-role')).toHaveTextContent('Invited Member');
      expect(resendButton()).toBeDisabled();
    });

    it('has "Resend Invite" button only if `canAddMembers` is true', function () {
      render(<OrganizationMemberRow {...props} canAddMembers />);

      expect(screen.getByTestId('member-role')).toHaveTextContent('Invited Member');
      expect(resendButton()).toBeEnabled();
    });

    it('has the right inviting states', function () {
      render(<OrganizationMemberRow {...props} canAddMembers />);

      expect(resendButton()).toBeInTheDocument();
    });

    it('has loading state', function () {
      render(<OrganizationMemberRow {...props} canAddMembers status="loading" />);

      // Should have loader
      expect(screen.getByTestId('loading-indicator')).toBeInTheDocument();

      // No Resend Invite button
      expect(resendButton()).not.toBeInTheDocument();
    });

    it('has success status', function () {
      render(<OrganizationMemberRow {...props} canAddMembers status="success" />);

      // Should not have loader
      expect(screen.queryByTestId('loading-indicator')).not.toBeInTheDocument();

      // No Resend Invite button
      expect(resendButton()).not.toBeInTheDocument();
      expect(screen.getByTestId('member-status')).toHaveTextContent('Sent!');
    });
  });

  describe('Expired user', function () {
    it('has "Expired" status', function () {
      render(
        <OrganizationMemberRow
          {...defaultProps}
          canAddMembers
          member={{...member, pending: true, expired: true}}
        />
      );

      expect(screen.getByTestId('member-role')).toHaveTextContent('Expired Invite');
      expect(resendButton()).toBeEnabled();
    });
  });

  describe('Requires SSO Link', function () {
    const props = {
      ...defaultProps,
      flags: {'sso:link': false},
      requireLink: true,
    };

    it('shows "Invited" status if user has not registered and not linked', function () {
      render(
        <OrganizationMemberRow
          {...props}
          canAddMembers
          member={{...member, pending: true}}
        />
      );

      expect(screen.getByTestId('member-role')).toHaveTextContent('Invited Member');
      expect(resendButton()).toBeEnabled();
    });

    it('shows "missing SSO link" message if user is registered and needs link', function () {
      render(<OrganizationMemberRow {...props} />);

      expect(screen.getByTestId('member-role')).toHaveTextContent('Member');
      expect(resendSsoButton()).toBeDisabled();
    });

    it('has "Resend SSO link" button only if `canAddMembers` is true and no link', function () {
      render(<OrganizationMemberRow {...props} canAddMembers />);

      expect(resendSsoButton()).toBeEnabled();
    });

    it('has 2fa warning if user is linked does not have 2fa enabled', function () {
      render(
        <OrganizationMemberRow
          {...defaultProps}
          member={{
            ...member,
            flags: {'sso:linked': true},
            user: {...member.user, has2fa: false},
          }}
        />
      );

      expect(screen.getByText('2FA Not Enabled')).toBeInTheDocument();
      expect(screen.queryByText('2FA Enabled')).not.toBeInTheDocument();
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
      render(<OrganizationMemberRow {...props} memberCanLeave />);

      expect(leaveButton()).toBeInTheDocument();
      expect(removeButton()).not.toBeInTheDocument();
    });

    it('has disabled button to leave organization and no button to remove when member can not leave', function () {
      render(<OrganizationMemberRow {...props} memberCanLeave={false} />);

      expect(leaveButton()).toBeDisabled();
      expect(removeButton()).not.toBeInTheDocument();
    });
  });

  describe('Not Current User', function () {
    const props = {
      ...defaultProps,
    };

    it('does not have Leave button', function () {
      render(<OrganizationMemberRow {...props} memberCanLeave />);

      expect(leaveButton()).not.toBeInTheDocument();
    });

    it('has Remove disabled button when `canRemoveMembers` is false', function () {
      render(<OrganizationMemberRow {...props} />);

      expect(removeButton()).toBeDisabled();
    });

    it('has Remove button when `canRemoveMembers` is true', function () {
      render(<OrganizationMemberRow {...props} canRemoveMembers />);

      expect(removeButton()).toBeEnabled();
    });
  });
});
