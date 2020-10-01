import {Modal} from 'react-bootstrap';
import React from 'react';

import {mountWithTheme} from 'sentry-test/enzyme';

import InviteMembersModal from 'app/components/modals/inviteMembersModal';
import TeamStore from 'app/stores/teamStore';

describe('InviteMembersModal', function () {
  const team = TestStubs.Team();
  const org = TestStubs.Organization({access: ['member:write'], teams: [team]});
  TeamStore.loadInitialData([team]);

  const noWriteOrg = TestStubs.Organization({
    access: [],
  });

  const roles = [
    {
      id: 'admin',
      name: 'Admin',
      desc: 'This is the admin role',
      allowed: true,
    },
    {
      id: 'member',
      name: 'Member',
      desc: 'This is the member role',
      allowed: true,
    },
  ];

  MockApiClient.addMockResponse({
    url: `/organizations/${org.slug}/members/me/`,
    method: 'GET',
    body: {roles},
  });

  it('renders', async function () {
    const wrapper = mountWithTheme(
      <InviteMembersModal
        Body={Modal.Body}
        Header={Modal.Header}
        Footer={Modal.Footer}
        organization={org}
      />,
      TestStubs.routerContext()
    );

    // Starts with one invite row
    expect(wrapper.find('StyledInviteRow')).toHaveLength(1);

    // We have two roles loaded from the members/me endpoint, defaulting to the
    // 'member' role.
    expect(wrapper.find('RoleSelectControl').props().options).toHaveLength(roles.length);
    expect(wrapper.find('RoleSelectControl Value').text()).toBe('Member');
  });

  it('renders without organization.access', async function () {
    const organization = TestStubs.Organization({access: undefined});
    const wrapper = mountWithTheme(
      <InviteMembersModal
        Body={Modal.Body}
        Header={Modal.Header}
        Footer={Modal.Footer}
        organization={organization}
      />,
      TestStubs.routerContext()
    );

    expect(wrapper.find('StyledInviteRow').exists()).toBe(true);
  });

  it('can add a second row', async function () {
    const wrapper = mountWithTheme(
      <InviteMembersModal
        Body={Modal.Body}
        Header={Modal.Header}
        Footer={Modal.Footer}
        organization={org}
      />,
      TestStubs.routerContext()
    );

    expect(wrapper.find('StyledInviteRow')).toHaveLength(1);
    wrapper.find('AddButton').simulate('click');
    expect(wrapper.find('StyledInviteRow')).toHaveLength(2);
  });

  it('errors on duplicate emails', async function () {
    const wrapper = mountWithTheme(
      <InviteMembersModal
        Body={Modal.Body}
        Header={Modal.Header}
        Footer={Modal.Footer}
        organization={org}
      />,
      TestStubs.routerContext()
    );

    wrapper.find('AddButton').simulate('click');
    expect(wrapper.find('StyledInviteRow')).toHaveLength(2);

    const rows = wrapper.find('StyledInviteRow');

    rows
      .at(0)
      .props()
      .onChangeEmails([{value: 'test@test.com'}]);
    rows
      .at(1)
      .props()
      .onChangeEmails([{value: 'test@test.com'}]);
    wrapper.update();

    expect(wrapper.find('StatusMessage[status="error"]').text()).toBe(
      'Duplicate emails between invite rows.'
    );
  });

  it('indicates the total invites on the invite button', function () {
    const wrapper = mountWithTheme(
      <InviteMembersModal
        Body={Modal.Body}
        Header={Modal.Header}
        Footer={Modal.Footer}
        organization={org}
      />,
      TestStubs.routerContext()
    );

    wrapper
      .find('StyledInviteRow')
      .first()
      .props()
      .onChangeEmails([{value: 'test1@test.com'}, {value: 'test2@test.com'}]);
    wrapper.update();

    expect(wrapper.find('Button[data-test-id="send-invites"]').text()).toBe(
      'Send invites (2)'
    );
  });

  it('can be closed', function () {
    const close = jest.fn();

    const wrapper = mountWithTheme(
      <InviteMembersModal
        Body={Modal.Body}
        Header={Modal.Header}
        Footer={Modal.Footer}
        organization={org}
        closeModal={close}
      />,
      TestStubs.routerContext()
    );

    wrapper.find('Button[data-test-id="cancel"]').simulate('click');
    expect(close).toHaveBeenCalled();
  });

  it('sends all successful invites', async function () {
    const createMemberMock = MockApiClient.addMockResponse({
      url: `/organizations/${org.slug}/members/`,
      method: 'POST',
    });

    const wrapper = mountWithTheme(
      <InviteMembersModal
        Body={Modal.Body}
        Header={Modal.Header}
        Footer={Modal.Footer}
        organization={org}
      />,
      TestStubs.routerContext()
    );

    wrapper.find('AddButton').simulate('click');

    // Setup two rows, one email each, the first with a admin role.
    const inviteRowProps = wrapper.find('StyledInviteRow').first().props();

    inviteRowProps.onChangeEmails([{value: 'test1@test.com'}]);
    inviteRowProps.onChangeRole({value: 'admin'});
    inviteRowProps.onChangeTeams([{value: 'team1'}]);
    wrapper
      .find('StyledInviteRow')
      .at(1)
      .props()
      .onChangeEmails([{value: 'test2@test.com'}]);

    wrapper.update();
    wrapper.find('FooterContent Button[priority="primary"]').simulate('click');

    // Verify data sent to the backend
    expect(createMemberMock).toHaveBeenCalledTimes(2);

    expect(createMemberMock).toHaveBeenNthCalledWith(
      1,
      `/organizations/${org.slug}/members/`,
      expect.objectContaining({
        data: {email: 'test1@test.com', role: 'admin', teams: ['team1']},
      })
    );
    expect(createMemberMock).toHaveBeenNthCalledWith(
      2,
      `/organizations/${org.slug}/members/`,
      expect.objectContaining({
        data: {email: 'test2@test.com', role: 'member', teams: []},
      })
    );

    // Pending invites being created..
    expect(
      wrapper.find('InviteRowControl SelectControl EmailLabel LoadingIndicator')
    ).toHaveLength(2);

    expect(wrapper.find('Button[data-test-id="cancel"][disabled]').exists()).toBe(true);
    expect(wrapper.find('Button[data-test-id="send-invites"][disabled]').exists()).toBe(
      true
    );
    expect(wrapper.find('StatusMessage LoadingIndicator').exists()).toBe(true);

    // Await request completion
    await tick();
    wrapper.update();

    expect(wrapper.find('StatusMessage').text()).toBe('Sent 2 invites');
    expect(wrapper.find('Button[data-test-id="close"]').exists()).toBe(true);
    expect(wrapper.find('Button[data-test-id="send-more"]').exists()).toBe(true);
    expect(wrapper.find('SelectControl EmailLabel IconCheckmark').exists()).toBe(true);

    // Send more reset the modal
    wrapper.find('Button[data-test-id="send-more"]').simulate('click');
    expect(wrapper.find('InviteRowControl SelectControl EmailLabel').exists()).toBe(
      false
    );
  });

  it('marks failed invites', async function () {
    const faildCreateMemberMock = MockApiClient.addMockResponse({
      url: `/organizations/${org.slug}/members/`,
      method: 'POST',
      statusCode: 400,
    });

    const wrapper = mountWithTheme(
      <InviteMembersModal
        Body={Modal.Body}
        Header={Modal.Header}
        Footer={Modal.Footer}
        organization={org}
      />,
      TestStubs.routerContext()
    );

    const inviteRowProps = wrapper.find('StyledInviteRow').first().props();

    inviteRowProps.onChangeEmails([{value: 'bademail'}]);
    wrapper.update();
    wrapper.find('FooterContent Button[priority="primary"]').simulate('click');

    expect(faildCreateMemberMock).toHaveBeenCalled();

    // Await request completion
    await tick();
    wrapper.update();

    expect(wrapper.find('StatusMessage').text()).toBe(
      'Sent 0 invites, 1 failed to send.'
    );

    expect(wrapper.find('SelectControl EmailLabel IconWarning').exists()).toBe(true);
  });

  it('can send initial email', async function () {
    const createMemberMock = MockApiClient.addMockResponse({
      url: `/organizations/${org.slug}/members/`,
      method: 'POST',
    });

    const initialEmail = 'test@gmail.com';
    const initialData = [{emails: new Set([initialEmail])}];

    const wrapper = mountWithTheme(
      <InviteMembersModal
        Body={Modal.Body}
        Header={Modal.Header}
        Footer={Modal.Footer}
        organization={org}
        initialData={initialData}
      />,
      TestStubs.routerContext()
    );

    expect(
      wrapper
        .find('span[className="Select-value-label"]')
        .first()
        .text()
        .includes(initialEmail)
    ).toBe(true);

    wrapper.find('FooterContent Button[priority="primary"]').simulate('click');
    await tick();
    wrapper.update();

    expect(createMemberMock).toHaveBeenCalledWith(
      `/organizations/${org.slug}/members/`,
      expect.objectContaining({
        data: {email: initialEmail, role: 'member', teams: []},
      })
    );

    expect(wrapper.find('StatusMessage').text()).toBe('Sent 1 invite');
  });

  it('can send initial email with role and team', async function () {
    const createMemberMock = MockApiClient.addMockResponse({
      url: `/organizations/${org.slug}/members/`,
      method: 'POST',
    });

    const initialEmail = 'test@gmail.com';
    const role = 'admin';
    const initialData = [
      {emails: new Set([initialEmail]), role, teams: new Set([team.slug])},
    ];

    const wrapper = mountWithTheme(
      <InviteMembersModal
        Body={Modal.Body}
        Header={Modal.Header}
        Footer={Modal.Footer}
        organization={org}
        initialData={initialData}
      />,
      TestStubs.routerContext()
    );

    expect(
      wrapper
        .find('SelectControl[data-test-id="select-emails"]')
        .text()
        .includes(initialEmail)
    ).toBe(true);

    expect(
      wrapper.find('SelectControl[data-test-id="select-role"]').text().toLowerCase()
    ).toBe(role);

    expect(
      wrapper
        .find('SelectControl[data-test-id="select-teams"]')
        .text()
        .includes(team.slug)
    ).toBe(true);

    wrapper.find('FooterContent Button[priority="primary"]').simulate('click');
    await tick();
    wrapper.update();

    expect(createMemberMock).toHaveBeenCalledWith(
      `/organizations/${org.slug}/members/`,
      expect.objectContaining({
        data: {email: initialEmail, role, teams: [team.slug]},
      })
    );

    expect(wrapper.find('StatusMessage').text()).toBe('Sent 1 invite');
  });

  describe('member invite request mode', function () {
    it('has adjusted wording', function () {
      const wrapper = mountWithTheme(
        <InviteMembersModal
          Body={Modal.Body}
          Header={Modal.Header}
          Footer={Modal.Footer}
          organization={noWriteOrg}
        />,
        TestStubs.routerContext()
      );

      expect(wrapper.find('Button[data-test-id="send-invites"]').text()).toBe(
        'Send invite request'
      );

      expect(wrapper.find('Heading Tooltip').exists()).toBe(true);
    });

    it('POSTS to the invite-request endpoint', function () {
      const createInviteRequestMock = MockApiClient.addMockResponse({
        url: `/organizations/${org.slug}/invite-requests/`,
        method: 'POST',
      });

      const wrapper = mountWithTheme(
        <InviteMembersModal
          Body={Modal.Body}
          Header={Modal.Header}
          Footer={Modal.Footer}
          organization={noWriteOrg}
        />,
        TestStubs.routerContext()
      );

      const inviteRowProps = wrapper.find('StyledInviteRow').first().props();

      inviteRowProps.onChangeEmails([{value: 'test1@test.com'}]);
      inviteRowProps.onChangeRole({value: 'admin'});
      inviteRowProps.onChangeTeams([{value: 'team1'}]);
      wrapper
        .find('StyledInviteRow')
        .first()
        .props()
        .onChangeEmails([{value: 'test2@test.com'}]);

      wrapper.update();
      wrapper.find('FooterContent Button[priority="primary"]').simulate('click');

      expect(createInviteRequestMock).toHaveBeenCalledTimes(1);
    });
  });
});
