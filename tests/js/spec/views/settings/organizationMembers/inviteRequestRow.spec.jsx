import React from 'react';
import {mountWithTheme} from 'sentry-test/enzyme';

import InviteRequestRow from 'app/views/settings/organizationMembers/inviteRequestRow';

describe('InviteRequestRow', function() {
  const orgId = 'org-slug';
  const inviteRequestBusy = new Map();

  const inviteRequest = TestStubs.Member({
    user: null,
    inviterName: TestStubs.User().name,
    inviteStatus: 'requested_to_be_invited',
    roleName: 'member',
  });

  const joinRequest = TestStubs.Member({
    user: null,
    inviteStatus: 'requested_to_join',
    roleName: 'member',
  });

  it('renders request to be invited', function() {
    const wrapper = mountWithTheme(
      <InviteRequestRow
        orgId={orgId}
        inviteRequest={inviteRequest}
        inviteRequestBusy={inviteRequestBusy}
      />
    );

    expect(wrapper.find('UserName').text()).toBe(inviteRequest.email);
    expect(
      wrapper
        .find('Description')
        .text()
        .includes(inviteRequest.inviterName)
    ).toBe(true);
  });

  it('renders request to join', function() {
    const wrapper = mountWithTheme(
      <InviteRequestRow
        orgId={orgId}
        inviteRequest={joinRequest}
        inviteRequestBusy={inviteRequestBusy}
      />
    );

    expect(wrapper.find('UserName').text()).toBe(joinRequest.email);
    expect(wrapper.find('JoinRequestIndicator').exists()).toBe(true);
  });

  it('can approve invite request', function() {
    const mockApprove = jest.fn();
    const mockDeny = jest.fn();

    const wrapper = mountWithTheme(
      <InviteRequestRow
        orgId={orgId}
        inviteRequest={inviteRequest}
        inviteRequestBusy={inviteRequestBusy}
        onApprove={mockApprove}
        onDeny={mockDeny}
      />
    );

    wrapper.find('button[aria-label="Approve"]').simulate('click');
    wrapper.find('button[aria-label="Confirm"]').simulate('click');
    expect(mockApprove).toHaveBeenCalledWith(inviteRequest);
    expect(mockDeny).not.toHaveBeenCalled();
  });

  it('can deny invite request', function() {
    const mockApprove = jest.fn();

    const mockDeny = jest.fn();
    const wrapper = mountWithTheme(
      <InviteRequestRow
        orgId={orgId}
        inviteRequest={inviteRequest}
        inviteRequestBusy={inviteRequestBusy}
        onApprove={mockApprove}
        onDeny={mockDeny}
      />
    );

    wrapper.find('button[aria-label="Deny"]').simulate('click');
    expect(mockDeny).toHaveBeenCalledWith(inviteRequest);
    expect(mockApprove).not.toHaveBeenCalled();
  });
});
