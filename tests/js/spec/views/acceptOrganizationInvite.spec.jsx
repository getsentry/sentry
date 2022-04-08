import {browserHistory} from 'react-router';

import {mountWithTheme} from 'sentry-test/enzyme';

import {logout} from 'sentry/actionCreators/account';
import AcceptOrganizationInvite from 'sentry/views/acceptOrganizationInvite';

jest.mock('sentry/actionCreators/account');

const addMock = body =>
  MockApiClient.addMockResponse({
    url: '/accept-invite/1/abc/',
    method: 'GET',
    body,
  });

describe('AcceptOrganizationInvite', function () {
  it('can accept invitation', async function () {
    addMock({
      orgSlug: 'test-org',
      needsAuthentication: false,
      needs2fa: false,
      hasAuthProvider: false,
      requireSso: false,
      existingMember: false,
    });

    const wrapper = mountWithTheme(
      <AcceptOrganizationInvite params={{memberId: '1', token: 'abc'}} />
    );

    const joinButton = wrapper.find('Button[aria-label="join-organization"]');

    expect(joinButton.exists()).toBe(true);
    expect(joinButton.text()).toBe('Join the test-org organization');

    const acceptMock = MockApiClient.addMockResponse({
      url: '/accept-invite/1/abc/',
      method: 'POST',
    });

    joinButton.simulate('click');
    expect(acceptMock).toHaveBeenCalled();
    expect(wrapper.find('Button[aria-label="join-organization"]').props().disabled).toBe(
      true
    );

    await tick();
    expect(browserHistory.replace).toHaveBeenCalledWith('/test-org/');
  });

  it('requires authentication to join', function () {
    addMock({
      orgSlug: 'test-org',
      needsAuthentication: true,
      needs2fa: false,
      hasAuthProvider: false,
      requireSso: false,
      existingMember: false,
    });

    const wrapper = mountWithTheme(
      <AcceptOrganizationInvite params={{memberId: '1', token: 'abc'}} />
    );

    const joinButton = wrapper.find('Button[aria-label="join-organization"]');
    expect(joinButton.exists()).toBe(false);

    expect(wrapper.find('[data-test-id="action-info-general"]').exists()).toBe(true);
    expect(wrapper.find('[data-test-id="action-info-sso"]').exists()).toBe(false);

    expect(wrapper.find('Button[aria-label="sso-login"]').exists()).toBe(false);
    expect(wrapper.find('Button[aria-label="create-account"]').exists()).toBe(true);
    expect(wrapper.find('[data-test-id="link-with-existing"]').exists()).toBe(true);
  });

  it('suggests sso authentication to login', function () {
    addMock({
      orgSlug: 'test-org',
      needsAuthentication: true,
      needs2fa: false,
      hasAuthProvider: true,
      requireSso: false,
      existingMember: false,
    });

    const wrapper = mountWithTheme(
      <AcceptOrganizationInvite params={{memberId: '1', token: 'abc'}} />
    );

    const joinButton = wrapper.find('Button[aria-label="join-organization"]');
    expect(joinButton.exists()).toBe(false);

    expect(wrapper.find('[data-test-id="action-info-general"]').exists()).toBe(true);
    expect(wrapper.find('[data-test-id="action-info-sso"]').exists()).toBe(true);

    expect(wrapper.find('Button[aria-label="sso-login"]').exists()).toBe(true);
    expect(wrapper.find('Button[aria-label="create-account"]').exists()).toBe(true);
    expect(wrapper.find('[data-test-id="link-with-existing"]').exists()).toBe(true);
  });

  it('enforce required sso authentication', function () {
    addMock({
      orgSlug: 'test-org',
      needsAuthentication: true,
      needs2fa: false,
      hasAuthProvider: true,
      requireSso: true,
      existingMember: false,
    });

    const wrapper = mountWithTheme(
      <AcceptOrganizationInvite params={{memberId: '1', token: 'abc'}} />
    );

    const joinButton = wrapper.find('Button[aria-label="join-organization"]');
    expect(joinButton.exists()).toBe(false);

    expect(wrapper.find('[data-test-id="action-info-general"]').exists()).toBe(false);
    expect(wrapper.find('[data-test-id="action-info-sso"]').exists()).toBe(true);

    expect(wrapper.find('Button[aria-label="sso-login"]').exists()).toBe(true);
    expect(wrapper.find('Button[aria-label="create-account"]').exists()).toBe(false);
    expect(wrapper.find('[data-test-id="link-with-existing"]').exists()).toBe(false);
  });

  it('enforce required sso authentication for logged in users', function () {
    addMock({
      orgSlug: 'test-org',
      needsAuthentication: false,
      needs2fa: false,
      hasAuthProvider: true,
      requireSso: true,
      existingMember: false,
    });

    const wrapper = mountWithTheme(
      <AcceptOrganizationInvite params={{memberId: '1', token: 'abc'}} />
    );

    const joinButton = wrapper.find('Button[aria-label="join-organization"]');
    expect(joinButton.exists()).toBe(false);

    expect(wrapper.find('[data-test-id="action-info-general"]').exists()).toBe(false);
    expect(wrapper.find('[data-test-id="action-info-sso"]').exists()).toBe(true);

    expect(wrapper.find('Button[aria-label="sso-login"]').exists()).toBe(true);
    expect(wrapper.find('Button[aria-label="create-account"]').exists()).toBe(false);
    expect(wrapper.find('[data-test-id="link-with-existing"]').exists()).toBe(false);
  });

  it('show logout button for logged in users w/ sso and membership', async function () {
    addMock({
      orgSlug: 'test-org',
      needsAuthentication: false,
      needs2fa: false,
      hasAuthProvider: true,
      requireSso: true,
      existingMember: true,
    });

    const wrapper = mountWithTheme(
      <AcceptOrganizationInvite params={{memberId: '1', token: 'abc'}} />
    );

    const existingMember = wrapper.find('[data-test-id="existing-member"]');
    expect(existingMember.exists()).toBe(true);

    const {replace} = window.location;
    window.location.replace = jest.fn();

    existingMember
      .find('[data-test-id="existing-member-link"]')
      .hostNodes()
      .simulate('click');
    expect(logout).toHaveBeenCalled();
    await tick();
    expect(window.location.replace).toHaveBeenCalled();

    window.location.replace = replace;
  });

  it('shows right options for logged in user and optional SSO', async function () {
    addMock({
      orgSlug: 'test-org',
      needsAuthentication: false,
      needs2fa: false,
      hasAuthProvider: true,
      requireSso: false,
      existingMember: false,
    });

    const wrapper = mountWithTheme(
      <AcceptOrganizationInvite params={{memberId: '1', token: 'abc'}} />
    );

    const ssoLink = wrapper.find('[data-test-id="action-info-sso"]');
    expect(ssoLink.exists()).toBe(true);

    const joinButton = wrapper.find('Button[aria-label="join-organization"]');
    expect(joinButton.exists()).toBe(true);
  });

  it('shows a logout button for existing members', async function () {
    addMock({
      orgSlug: 'test-org',
      needsAuthentication: false,
      needs2fa: false,
      hasAuthProvider: false,
      requireSso: false,
      existingMember: true,
    });

    const wrapper = mountWithTheme(
      <AcceptOrganizationInvite params={{memberId: '1', token: 'abc'}} />
    );

    const existingMember = wrapper.find('[data-test-id="existing-member"]');
    expect(existingMember.exists()).toBe(true);

    const {replace} = window.location;
    window.location.replace = jest.fn();

    existingMember
      .find('[data-test-id="existing-member-link"]')
      .hostNodes()
      .simulate('click');
    expect(logout).toHaveBeenCalled();
    await tick();
    expect(window.location.replace).toHaveBeenCalled();

    window.location.replace = replace;
  });

  it('shows 2fa warning', function () {
    addMock({
      orgSlug: 'test-org',
      needsAuthentication: false,
      needs2fa: true,
      hasAuthProvider: false,
      requireSso: false,
      existingMember: false,
    });

    const wrapper = mountWithTheme(
      <AcceptOrganizationInvite params={{memberId: '1', token: 'abc'}} />
    );

    expect(wrapper.find('[data-test-id="2fa-warning"]').exists()).toBe(true);
  });
});
