import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {logout} from 'sentry/actionCreators/account';
import ConfigStore from 'sentry/stores/configStore';
import AcceptOrganizationInvite from 'sentry/views/acceptOrganizationInvite';

jest.mock('sentry/actionCreators/account');

const addMock = (body: any) =>
  MockApiClient.addMockResponse({
    url: '/accept-invite/org-slug/1/abc/',
    method: 'GET',
    body,
  });

const getJoinButton = () => {
  const maybeButton = screen.queryByRole('button', {
    name: 'Join the org-slug organization',
  });
  return maybeButton;
};

describe('AcceptOrganizationInvite', function () {
  const organization = OrganizationFixture({slug: 'org-slug'});
  const configState = ConfigStore.getState();

  const defaultRouterConfig = {
    location: {
      pathname: '/accept-invite/org-slug/1/abc/',
    },
    route: '/accept-invite/:orgId/:memberId/:token/',
  };

  afterEach(() => {
    ConfigStore.loadInitialData(configState);
  });

  it('can accept invitation', async function () {
    addMock({
      orgSlug: organization.slug,
      needsAuthentication: false,
      needs2fa: false,
      hasAuthProvider: false,
      requireSso: false,
      existingMember: false,
    });

    render(<AcceptOrganizationInvite />, {
      disableRouterMocks: true,
      initialRouterConfig: defaultRouterConfig,
    });

    const acceptMock = MockApiClient.addMockResponse({
      url: '/accept-invite/org-slug/1/abc/',
      method: 'POST',
    });

    const joinButton = await screen.findByRole('button', {
      name: 'Join the org-slug organization',
    });

    await userEvent.click(joinButton);
    expect(acceptMock).toHaveBeenCalled();
    expect(window.location.href).toBe('/org-slug/');
  });

  it('can accept invitation on customer-domains', async function () {
    ConfigStore.set('customerDomain', {
      subdomain: 'org-slug',
      organizationUrl: 'https://org-slug.sentry.io',
      sentryUrl: 'https://sentry.io',
    });
    ConfigStore.set('links', {
      ...configState.links,
      sentryUrl: 'https://sentry.io',
    });

    addMock({
      orgSlug: organization.slug,
      needsAuthentication: false,
      needs2fa: false,
      hasAuthProvider: false,
      requireSso: false,
      existingMember: false,
    });

    render(<AcceptOrganizationInvite />, {
      disableRouterMocks: true,
      initialRouterConfig: defaultRouterConfig,
    });

    const acceptMock = MockApiClient.addMockResponse({
      url: '/accept-invite/org-slug/1/abc/',
      method: 'POST',
    });

    const joinButton = await screen.findByRole('button', {
      name: 'Join the org-slug organization',
    });

    await userEvent.click(joinButton);
    expect(acceptMock).toHaveBeenCalled();
    expect(window.location.href).toBe('/org-slug/');
  });

  it('renders error message', async function () {
    MockApiClient.addMockResponse({
      url: '/accept-invite/1/abc/',
      method: 'GET',
      statusCode: 400,
      body: {detail: 'uh oh'},
    });

    render(<AcceptOrganizationInvite />, {
      disableRouterMocks: true,
      initialRouterConfig: {
        location: {
          pathname: '/accept-invite/1/abc/',
        },
        route: '/accept-invite/:memberId/:token/',
      },
    });

    expect(
      await screen.findByText(/This organization invite link is invalid/)
    ).toBeInTheDocument();
  });

  it('requires authentication to join', async function () {
    addMock({
      orgSlug: organization.slug,
      needsAuthentication: true,
      needs2fa: false,
      hasAuthProvider: false,
      requireSso: false,
      existingMember: false,
    });

    render(<AcceptOrganizationInvite />, {
      disableRouterMocks: true,
      initialRouterConfig: defaultRouterConfig,
    });

    await waitFor(() => expect(getJoinButton()).not.toBeInTheDocument());
    expect(screen.getByTestId('action-info-general')).toBeInTheDocument();
    expect(screen.queryByTestId('action-info-sso')).not.toBeInTheDocument();

    expect(
      screen.getByRole('button', {name: 'Create a new account'})
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', {name: 'Login using an existing account'})
    ).toBeInTheDocument();
  });

  it('suggests sso authentication to login', async function () {
    addMock({
      orgSlug: organization.slug,
      needsAuthentication: true,
      needs2fa: false,
      hasAuthProvider: true,
      requireSso: false,
      existingMember: false,
      ssoProvider: 'SSO',
    });

    render(<AcceptOrganizationInvite />, {
      disableRouterMocks: true,
      initialRouterConfig: defaultRouterConfig,
    });

    await waitFor(() => expect(getJoinButton()).not.toBeInTheDocument());
    expect(screen.getByTestId('action-info-general')).toBeInTheDocument();
    expect(screen.getByTestId('action-info-sso')).toBeInTheDocument();

    expect(screen.getByRole('button', {name: 'Join with SSO'})).toBeInTheDocument();
    expect(
      screen.getByRole('button', {name: 'Create a new account'})
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', {name: 'Login using an existing account'})
    ).toBeInTheDocument();
  });

  it('enforce required sso authentication', async function () {
    addMock({
      orgSlug: organization.slug,
      needsAuthentication: true,
      needs2fa: false,
      hasAuthProvider: true,
      requireSso: true,
      existingMember: false,
      ssoProvider: 'SSO',
    });

    render(<AcceptOrganizationInvite />, {
      disableRouterMocks: true,
      initialRouterConfig: defaultRouterConfig,
    });

    await waitFor(() => expect(getJoinButton()).not.toBeInTheDocument());
    expect(screen.queryByTestId('action-info-general')).not.toBeInTheDocument();
    expect(screen.getByTestId('action-info-sso')).toBeInTheDocument();

    expect(screen.getByRole('button', {name: 'Join with SSO'})).toBeInTheDocument();
    expect(
      screen.queryByRole('button', {name: 'Create a new account'})
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('link', {name: 'Login using an existing account'})
    ).not.toBeInTheDocument();
  });

  it('enforce required sso authentication for logged in users', async function () {
    addMock({
      orgSlug: organization.slug,
      needsAuthentication: false,
      needs2fa: false,
      hasAuthProvider: true,
      requireSso: true,
      existingMember: false,
      ssoProvider: 'SSO',
    });

    render(<AcceptOrganizationInvite />, {
      disableRouterMocks: true,
      initialRouterConfig: defaultRouterConfig,
    });

    await waitFor(() => expect(getJoinButton()).not.toBeInTheDocument());
    expect(screen.queryByTestId('action-info-general')).not.toBeInTheDocument();
    expect(screen.getByTestId('action-info-sso')).toBeInTheDocument();

    expect(screen.getByRole('button', {name: 'Join with SSO'})).toBeInTheDocument();
    expect(
      screen.queryByRole('button', {name: 'Create a new account'})
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('link', {name: 'Login using an existing account'})
    ).not.toBeInTheDocument();
  });

  it('show logout button for logged in users w/ sso and membership', async function () {
    addMock({
      orgSlug: organization.slug,
      needsAuthentication: false,
      needs2fa: false,
      hasAuthProvider: true,
      requireSso: true,
      existingMember: true,
      ssoProvider: 'SSO',
    });

    render(<AcceptOrganizationInvite />, {
      disableRouterMocks: true,
      initialRouterConfig: defaultRouterConfig,
    });

    await screen.findByTestId('existing-member');
    await userEvent.click(screen.getByTestId('existing-member-link'));
    await waitFor(() => expect(logout).toHaveBeenCalled());
  });

  it('shows right options for logged in user and optional SSO', async function () {
    addMock({
      orgSlug: organization.slug,
      needsAuthentication: false,
      needs2fa: false,
      hasAuthProvider: true,
      requireSso: false,
      existingMember: false,
      ssoProvider: 'SSO',
    });

    render(<AcceptOrganizationInvite />, {
      disableRouterMocks: true,
      initialRouterConfig: defaultRouterConfig,
    });

    await screen.findByTestId('action-info-sso');
    expect(getJoinButton()).toBeInTheDocument();
  });

  it('shows a logout button for existing members', async function () {
    addMock({
      orgSlug: organization.slug,
      needsAuthentication: false,
      needs2fa: false,
      hasAuthProvider: false,
      requireSso: false,
      existingMember: true,
    });

    render(<AcceptOrganizationInvite />, {
      disableRouterMocks: true,
      initialRouterConfig: defaultRouterConfig,
    });

    await screen.findByTestId('existing-member');
    await userEvent.click(screen.getByTestId('existing-member-link'));
    await waitFor(() => expect(logout).toHaveBeenCalled());
  });

  it('shows 2fa warning', async function () {
    addMock({
      orgSlug: organization.slug,
      needsAuthentication: false,
      needs2fa: true,
      hasAuthProvider: false,
      requireSso: false,
      existingMember: false,
    });

    render(<AcceptOrganizationInvite />, {
      disableRouterMocks: true,
      initialRouterConfig: defaultRouterConfig,
    });

    await screen.findByRole('button', {name: 'Configure Two-Factor Auth'});
  });
});
