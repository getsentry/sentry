import React from 'react';
import {shallow} from 'enzyme';

import OrganizationMemberRow from 'app/views/settings/organizationMembers/organizationMemberRow';

const findWithText = (wrapper, text) =>
  wrapper.filterWhere(n => n.prop('children') && n.prop('children').includes(text));

describe('OrganizationMemberRow', function() {
  let member = {
    id: '1',
    email: '',
    name: '',
    role: '',
    roleName: '',
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

  let currentUser = {
    id: '2',
    email: 'currentUser@email.com',
  };

  let defaultProps = {
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

  beforeEach(function() {});

  it('does not have 2fa warning if user has 2fa', function() {
    let wrapper = shallow(
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
    expect(wrapper.find('NoTwoFactorIcon')).toHaveLength(0);
    expect(wrapper.find('HasTwoFactorIcon')).toHaveLength(1);
  });

  it('has 2fa warning if user does not have 2fa enabled', function() {
    let wrapper = shallow(
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
    expect(wrapper.find('NoTwoFactorIcon')).toHaveLength(1);
    expect(wrapper.find('HasTwoFactorIcon')).toHaveLength(0);
  });

  describe('Pending user', function() {
    let props = {
      ...defaultProps,
      member: {
        ...member,
        pending: true,
      },
    };

    it('has "Invited" status, no "Resend Invite"', function() {
      let wrapper = shallow(
        <OrganizationMemberRow
          {...props}
          member={{
            ...member,
            pending: true,
          }}
        />
      );

      expect(findWithText(wrapper.find('strong'), 'Invited')).toHaveLength(1);

      expect(wrapper.find('ResendInviteButton')).toHaveLength(0);
    });

    it('has "Resend Invite" button only if `canAddMembers` is true', function() {
      let wrapper = shallow(<OrganizationMemberRow {...props} canAddMembers={true} />);

      expect(findWithText(wrapper.find('strong'), 'Invited')).toHaveLength(1);

      expect(wrapper.find('ResendInviteButton')).toHaveLength(1);
    });

    it('has the right inviting states', function() {
      let wrapper = shallow(<OrganizationMemberRow {...props} canAddMembers={true} />);

      expect(wrapper.find('ResendInviteButton')).toHaveLength(1);

      wrapper = shallow(
        <OrganizationMemberRow {...props} canAddMembers={true} status="loading" />
      );

      // Should have loader
      expect(wrapper.find('LoadingIndicator')).toHaveLength(1);
      // No Resend Invite button
      expect(wrapper.find('ResendInviteButton')).toHaveLength(0);

      wrapper = shallow(
        <OrganizationMemberRow {...props} canAddMembers={true} status="success" />
      );

      // Should have loader
      expect(wrapper.find('LoadingIndicator')).toHaveLength(0);
      // No Resend Invite button
      expect(wrapper.find('ResendInviteButton')).toHaveLength(0);
      expect(findWithText(wrapper.find('span'), 'Sent!')).toHaveLength(1);
    });
  });

  describe('Requires SSO Link', function() {
    let props = {
      ...defaultProps,
      flags: {
        'sso:link': false,
      },
      requireLink: true,
    };

    it('shows "Invited" status if user has not registered and not linked', function() {
      let wrapper = shallow(
        <OrganizationMemberRow
          {...props}
          member={{
            ...member,
            pending: true,
          }}
        />
      );

      expect(findWithText(wrapper.find('strong'), 'Invited')).toHaveLength(1);

      expect(wrapper.find('ResendInviteButton')).toHaveLength(0);
    });

    it('shows "missing SSO link" message if user is registered and needs link', function() {
      let wrapper = shallow(
        <OrganizationMemberRow
          {...props}
          member={{
            ...member,
          }}
        />
      );

      expect(findWithText(wrapper.find('strong'), 'Invited')).toHaveLength(0);
      expect(findWithText(wrapper.find('strong'), 'Missing SSO Link')).toHaveLength(1);
      expect(wrapper.find('ResendInviteButton')).toHaveLength(0);
    });

    it('has "Resend Invite" button only if `canAddMembers` is true and no link', function() {
      let wrapper = shallow(
        <OrganizationMemberRow
          {...props}
          canAddMembers={true}
          member={{
            ...member,
          }}
        />
      );

      expect(wrapper.find('ResendInviteButton')).toHaveLength(1);
    });

    it('has 2fa warning if user is linked does not have 2fa enabled', function() {
      let wrapper = shallow(
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
      expect(wrapper.find('NoTwoFactorIcon')).toHaveLength(1);
      expect(wrapper.find('HasTwoFactorIcon')).toHaveLength(0);
    });
  });

  describe('Is Current User', function() {
    let props = {
      ...defaultProps,
      member: {
        ...member,
        email: 'currentUser@email.com',
      },
    };

    it('has button to leave organization and no button to remove', function() {
      let wrapper = shallow(<OrganizationMemberRow {...props} memberCanLeave={true} />);
      expect(findWithText(wrapper.find('Button'), 'Leave')).toHaveLength(1);
      expect(findWithText(wrapper.find('Button'), 'Remove')).toHaveLength(0);
    });

    it('has disabled button to leave organization and no button to remove when member can not leave', function() {
      let wrapper = shallow(<OrganizationMemberRow {...props} memberCanLeave={false} />);
      expect(findWithText(wrapper.find('Button'), 'Leave')).toHaveLength(1);
      expect(
        findWithText(wrapper.find('Button'), 'Leave')
          .first()
          .prop('disabled')
      ).toBe(true);
      expect(findWithText(wrapper.find('Button'), 'Remove')).toHaveLength(0);
    });
  });

  describe('Not Current User', function() {
    let props = {
      ...defaultProps,
    };

    it('does not have Leave button', function() {
      let wrapper = shallow(<OrganizationMemberRow {...props} memberCanLeave={true} />);

      expect(findWithText(wrapper.find('Button'), 'Leave')).toHaveLength(0);
    });

    it('has Remove disabled button when `canRemoveMembers` is false', function() {
      let wrapper = shallow(<OrganizationMemberRow {...props} />);

      expect(findWithText(wrapper.find('Button'), 'Remove')).toHaveLength(1);
      expect(findWithText(wrapper.find('Button'), 'Remove').prop('disabled')).toBe(true);
    });

    it('has Remove button when `canRemoveMembers` is true', function() {
      let wrapper = shallow(<OrganizationMemberRow {...props} canRemoveMembers={true} />);

      let removeButton = findWithText(wrapper.find('Button'), 'Remove');
      expect(removeButton).toHaveLength(1);
      expect(removeButton.first().prop('disabled')).toBe(false);
    });
  });
});
