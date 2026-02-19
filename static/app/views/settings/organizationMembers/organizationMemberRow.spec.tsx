import {MemberFixture} from 'sentry-fixture/member';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {UserFixture} from 'sentry-fixture/user';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import OrganizationMemberRow from 'sentry/views/settings/organizationMembers/organizationMemberRow';

describe('OrganizationMemberRow', () => {
  const member = MemberFixture({
    id: '1',
    email: '',
    name: '',
    orgRole: 'member',
    roleName: 'Member',
    inviterName: 'Current User',
    pending: false,
    flags: {
      'sso:linked': false,
      'idp:provisioned': false,
      'idp:role-restricted': false,
      'member-limit:restricted': false,
      'partnership:restricted': false,
      'sso:invalid': false,
    },
    user: UserFixture({
      id: '',
      has2fa: false,
      name: 'sentry@test.com',
    }),
  });

  const currentUser = UserFixture({
    id: '2',
    email: 'currentUser@email.com',
    name: 'Current User',
  });

  const defaultProps: React.ComponentProps<typeof OrganizationMemberRow> = {
    organization: OrganizationFixture(),
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

  describe('two factor', () => {
    it('does not have 2fa warning if user has 2fa', () => {
      render(
        <OrganizationMemberRow
          {...defaultProps}
          member={MemberFixture({
            ...member,
            user: UserFixture({...member.user, has2fa: true}),
          })}
        />
      );

      expect(screen.getByText('2FA Enabled')).toBeInTheDocument();
      expect(screen.queryByText('2FA Not Enabled')).not.toBeInTheDocument();
    });

    it('has 2fa warning if user does not have 2fa enabled', () => {
      render(
        <OrganizationMemberRow
          {...defaultProps}
          member={{
            ...member,
            user: UserFixture({...member.user, has2fa: false}),
          }}
        />
      );

      expect(screen.getByText('2FA Not Enabled')).toBeInTheDocument();
      expect(screen.queryByText('2FA Enabled')).not.toBeInTheDocument();
    });
  });

  describe('Pending user', () => {
    const props = {
      ...defaultProps,
      member: {...member, pending: true},
    };

    it('has "Invited" status, no "Resend Invite"', () => {
      render(<OrganizationMemberRow {...props} />);

      expect(screen.getByTestId('member-role')).toHaveTextContent('Invited Member');
      expect(resendButton()).toBeDisabled();
    });

    it('has "Resend Invite" button if `canAddMembers` is true', () => {
      render(<OrganizationMemberRow {...props} canAddMembers />);

      expect(screen.getByTestId('member-role')).toHaveTextContent('Invited Member');
      expect(resendButton()).toBeEnabled();
    });

    it('has "Resend Invite" button if invite was sent from curr user and feature is on', () => {
      const org = OrganizationFixture({
        access: ['member:invite'],
      });
      render(<OrganizationMemberRow {...props} organization={org} />);

      expect(screen.getByTestId('member-role')).toHaveTextContent('Invited Member');
      expect(resendButton()).toBeEnabled();
    });

    it('does not have "Resend Invite" button if invite was sent from other user and feature is on', () => {
      const org = OrganizationFixture({
        access: ['member:invite'],
      });
      render(
        <OrganizationMemberRow
          {...props}
          organization={org}
          member={{...member, pending: true, inviterName: 'Other User'}}
        />
      );

      expect(screen.getByTestId('member-role')).toHaveTextContent('Invited Member');
      expect(resendButton()).toBeDisabled();
    });

    it('has the right inviting states', () => {
      render(<OrganizationMemberRow {...props} canAddMembers />);

      expect(resendButton()).toBeInTheDocument();
    });

    it('has loading state', () => {
      render(<OrganizationMemberRow {...props} canAddMembers status="loading" />);

      // Should have loader
      expect(screen.getByTestId('loading-indicator')).toBeInTheDocument();

      // No Resend Invite button
      expect(resendButton()).not.toBeInTheDocument();
    });

    it('has success status', () => {
      render(<OrganizationMemberRow {...props} canAddMembers status="success" />);

      // Should not have loader
      expect(screen.queryByTestId('loading-indicator')).not.toBeInTheDocument();

      // No Resend Invite button
      expect(resendButton()).not.toBeInTheDocument();
      expect(screen.getByTestId('member-status')).toHaveTextContent('Sent!');
    });

    it('has Remove button if invite was sent from curr user and feature is on', () => {
      const org = OrganizationFixture({
        access: ['member:invite'],
      });
      render(<OrganizationMemberRow {...props} organization={org} />);

      expect(removeButton()).toBeEnabled();
    });

    it('has disabled Remove button if invite was sent from other user and feature is on', () => {
      const org = OrganizationFixture({
        access: ['member:invite'],
      });
      render(
        <OrganizationMemberRow
          {...props}
          organization={org}
          member={{...member, pending: true, inviterName: 'Other User'}}
        />
      );

      expect(removeButton()).toBeDisabled();
    });
  });

  describe('Expired user', () => {
    it('has "Expired" status', () => {
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

  describe('Requires SSO Link', () => {
    const props = {
      ...defaultProps,
      flags: {'sso:link': false},
      requireLink: true,
    };

    it('shows "Invited" status if user has not registered and not linked', () => {
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

    it('shows "missing SSO link" message if user is registered and needs link', () => {
      render(<OrganizationMemberRow {...props} />);

      expect(screen.getByTestId('member-role')).toHaveTextContent('Member');
      expect(resendSsoButton()).toBeDisabled();
    });

    it('has "Resend SSO link" button only if `canAddMembers` is true and no link', () => {
      render(<OrganizationMemberRow {...props} canAddMembers />);

      expect(resendSsoButton()).toBeEnabled();
    });

    it('has 2fa warning if user is linked does not have 2fa enabled', () => {
      render(
        <OrganizationMemberRow
          {...defaultProps}
          member={{
            ...member,
            flags: {
              'sso:linked': true,
              'idp:provisioned': false,
              'idp:role-restricted': false,
              'member-limit:restricted': false,
              'partnership:restricted': false,
              'sso:invalid': false,
            },
            user: UserFixture({...member.user, has2fa: false}),
          }}
        />
      );

      expect(screen.getByText('2FA Not Enabled')).toBeInTheDocument();
      expect(screen.queryByText('2FA Enabled')).not.toBeInTheDocument();
    });
  });

  describe('Is Current User', () => {
    const props = {
      ...defaultProps,
      member: {...member, email: 'currentUser@email.com'},
    };

    it('has button to leave organization and no button to remove', () => {
      render(<OrganizationMemberRow {...props} memberCanLeave />);

      expect(leaveButton()).toBeInTheDocument();
      expect(removeButton()).not.toBeInTheDocument();
    });

    it('has disabled button to leave organization and no button to remove when member can not leave', () => {
      render(<OrganizationMemberRow {...props} memberCanLeave={false} />);

      expect(leaveButton()).toBeDisabled();
      expect(removeButton()).not.toBeInTheDocument();
    });
  });

  describe('IDP flags permissions', () => {
    member.flags['idp:provisioned'] = true;
    it('current user cannot leave if idp:provisioned', () => {
      const props = {
        ...defaultProps,
        member: {...member, email: 'currentUser@email.com'},
      };

      render(
        <OrganizationMemberRow
          {...props}
          memberCanLeave={!member.flags['idp:provisioned']}
        />
      );

      expect(leaveButton()).toBeDisabled();
    });

    it('cannot remove member if member is idp:provisioned', () => {
      render(<OrganizationMemberRow {...defaultProps} />);

      expect(removeButton()).toBeDisabled();
    });
  });

  describe('Not Current User', () => {
    const props = {
      ...defaultProps,
    };

    it('does not have Leave button', () => {
      render(<OrganizationMemberRow {...props} memberCanLeave />);

      expect(leaveButton()).not.toBeInTheDocument();
    });

    it('has Remove disabled button when `canRemoveMembers` is false', () => {
      member.flags['idp:provisioned'] = false;

      render(<OrganizationMemberRow {...props} />);

      expect(removeButton()).toBeDisabled();
    });

    it('has Remove button when `canRemoveMembers` is true', () => {
      member.flags['idp:provisioned'] = false;

      render(<OrganizationMemberRow {...props} canRemoveMembers />);

      expect(removeButton()).toBeEnabled();
    });
  });

  describe('Member with null user (eventual consistency)', () => {
    it('renders member row correctly when user is null', () => {
      const memberWithNullUser = MemberFixture({
        id: '1',
        email: 'deleted@example.com',
        name: 'Deleted User',
        orgRole: 'member',
        roleName: 'Member',
        pending: false,
        user: null,
        flags: {
          'sso:linked': false,
          'idp:provisioned': false,
          'idp:role-restricted': false,
          'member-limit:restricted': false,
          'partnership:restricted': false,
          'sso:invalid': false,
        },
      });

      render(
        <OrganizationMemberRow
          {...{
            organization: OrganizationFixture(),
            status: '',
            requireLink: false,
            memberCanLeave: false,
            canAddMembers: false,
            canRemoveMembers: false,
            member: memberWithNullUser,
            currentUser: UserFixture({id: '2', email: 'other@example.com'}),
            onSendInvite: () => {},
            onRemove: () => {},
            onLeave: () => {},
          }}
        />
      );

      // Should render without crashing
      expect(screen.getByText('Deleted User')).toBeInTheDocument();
      expect(screen.getByText('deleted@example.com')).toBeInTheDocument();
      // 2FA status should show "Not Enabled" since user is null (has2fa is undefined)
      expect(screen.getByText('2FA Not Enabled')).toBeInTheDocument();
    });

    it('renders avatar with fallback when user is null', () => {
      const memberWithNullUser = MemberFixture({
        id: '1',
        email: 'deleted@example.com',
        name: 'Deleted User',
        user: null,
        flags: {
          'sso:linked': false,
          'idp:provisioned': false,
          'idp:role-restricted': false,
          'member-limit:restricted': false,
          'partnership:restricted': false,
          'sso:invalid': false,
        },
      });

      render(
        <OrganizationMemberRow
          {...{
            organization: OrganizationFixture(),
            status: '',
            requireLink: false,
            memberCanLeave: false,
            canAddMembers: false,
            canRemoveMembers: false,
            member: memberWithNullUser,
            currentUser: UserFixture({id: '2', email: 'other@example.com'}),
            onSendInvite: () => {},
            onRemove: () => {},
            onLeave: () => {},
          }}
        />
      );

      // Component should render without crashing when user is null
      // The UserAvatar component uses fallback object (email as user data)
      expect(screen.getByText('Deleted User')).toBeInTheDocument();
      expect(screen.getByText('deleted@example.com')).toBeInTheDocument();
    });
  });
});
