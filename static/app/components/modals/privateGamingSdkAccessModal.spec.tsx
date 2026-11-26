import {OrganizationFixture} from 'sentry-fixture/organization';

import {
  act,
  renderGlobalModal,
  screen,
  userEvent,
  waitFor,
  within,
} from 'sentry-test/reactTestingLibrary';
import {selectEvent} from 'sentry-test/selectEvent';

import {openModal} from '@sentry/scraps/modal';

import * as analytics from 'sentry/utils/analytics';

import {PrivateGamingSdkAccessModal} from './privateGamingSdkAccessModal';

jest.mock('sentry/utils/analytics');

describe('PrivateGamingSdkAccessModal', () => {
  const organization = OrganizationFixture({
    enabledConsolePlatforms: ['playstation', 'xbox'],
  });
  const githubIdentity = {
    category: 'social-identity',
    id: '1',
    provider: {key: 'github', name: 'GitHub'},
    status: 'can_disconnect',
    organization: null,
  };

  beforeEach(() => {
    MockApiClient.clearMockResponses();
    jest.clearAllMocks();
  });

  it('sends invitations for the selected platforms', async () => {
    MockApiClient.addMockResponse({
      url: '/users/me/user-identities/',
      body: [githubIdentity],
    });
    const inviteRequest = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/console-sdk-invites/`,
      method: 'POST',
      body: {success: true, errors: null},
    });
    const onSubmit = jest.fn();

    renderGlobalModal();
    act(() =>
      openModal(modalProps => (
        <PrivateGamingSdkAccessModal
          {...modalProps}
          organization={organization}
          origin="org-settings"
          onSubmit={onSubmit}
        />
      ))
    );

    const sendButton = await screen.findByRole('button', {name: 'Send Invitation'});
    expect(sendButton).toBeDisabled();

    await selectEvent.select(
      screen.getByRole('textbox', {name: 'Select Gaming Platforms'}),
      'PlayStation'
    );
    expect(sendButton).toBeEnabled();

    await userEvent.click(sendButton);

    expect(
      await screen.findByText(
        'You have been invited to our private game console SDK GitHub repositories!'
      )
    ).toBeInTheDocument();
    expect(inviteRequest).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({data: {platforms: ['playstation']}})
    );
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(analytics.trackAnalytics).toHaveBeenCalledWith(
      'gaming.private_sdk_access_modal_submitted',
      expect.objectContaining({platforms: ['playstation'], origin: 'org-settings'})
    );
    expect(screen.getByRole('link', {name: 'PlayStation'})).toHaveAttribute(
      'href',
      'https://github.com/getsentry/sentry-playstation'
    );
  });

  it('submits the preselected platform', async () => {
    MockApiClient.addMockResponse({
      url: '/users/me/user-identities/',
      body: [githubIdentity],
    });
    const inviteRequest = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/console-sdk-invites/`,
      method: 'POST',
      body: {success: true, errors: null},
    });

    renderGlobalModal();
    act(() =>
      openModal(modalProps => (
        <PrivateGamingSdkAccessModal
          {...modalProps}
          organization={organization}
          origin="onboarding"
          gamingPlatform="xbox"
        />
      ))
    );

    await userEvent.click(await screen.findByRole('button', {name: 'Send Invitation'}));

    await waitFor(() =>
      expect(inviteRequest).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({data: {platforms: ['xbox']}})
      )
    );
  });

  it('shows the API error and keeps the form open', async () => {
    MockApiClient.addMockResponse({
      url: '/users/me/user-identities/',
      body: [githubIdentity],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/console-sdk-invites/`,
      method: 'POST',
      statusCode: 400,
      body: {error: 'Invite failed', detail: 'Not a member'},
    });

    renderGlobalModal();
    act(() =>
      openModal(modalProps => (
        <PrivateGamingSdkAccessModal
          {...modalProps}
          organization={organization}
          origin="onboarding"
          gamingPlatform="xbox"
        />
      ))
    );

    await userEvent.click(await screen.findByRole('button', {name: 'Send Invitation'}));

    expect(
      await within(screen.getByRole('dialog')).findByText('Invite failed - Not a member')
    ).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Send Invitation'})).toBeInTheDocument();
  });

  it('asks to link GitHub when the user has no GitHub identity', async () => {
    MockApiClient.addMockResponse({url: '/users/me/user-identities/', body: []});

    renderGlobalModal();
    act(() =>
      openModal(modalProps => (
        <PrivateGamingSdkAccessModal
          {...modalProps}
          organization={organization}
          origin="onboarding"
        />
      ))
    );

    expect(
      await screen.findByRole('button', {name: 'Log in with GitHub'})
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', {name: 'Send Invitation'})
    ).not.toBeInTheDocument();
  });
});
