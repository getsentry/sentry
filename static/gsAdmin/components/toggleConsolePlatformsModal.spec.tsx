import {OrganizationFixture} from 'sentry-fixture/organization';

import {renderGlobalModal, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {closeModal} from '@sentry/scraps/modal';

import {openToggleConsolePlatformsModal} from 'admin/components/toggleConsolePlatformsModal';

describe('ToggleConsolePlatformsModal', () => {
  const organization = OrganizationFixture({
    enabledConsolePlatforms: ['playstation'],
    consoleSdkInviteQuota: 5,
  });

  beforeEach(() => {
    MockApiClient.clearMockResponses();
    closeModal();
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/console-sdk-invites/`,
      body: [
        {
          email: 'user@example.com',
          memberId: '1',
          userId: '2',
          platforms: ['playstation', 'xbox'],
        },
      ],
    });
  });

  it('saves platforms, quota and pending revocations', async () => {
    const onSuccess = jest.fn();
    const updateMock = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/`,
      method: 'PUT',
      body: organization,
    });
    const revokeMock = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/console-sdk-invites/`,
      method: 'DELETE',
      body: {},
    });

    openToggleConsolePlatformsModal({organization, onSuccess});
    const {waitForModalToHide} = renderGlobalModal();

    expect(await screen.findByRole('checkbox', {name: 'PlayStation'})).toBeChecked();
    expect(screen.getByRole('checkbox', {name: 'Nintendo Switch'})).not.toBeChecked();
    expect(screen.getByRole('checkbox', {name: 'Xbox'})).not.toBeChecked();
    expect(
      screen.getByRole('spinbutton', {name: 'GitHub Repo Invite Quota'})
    ).toHaveValue(5);

    await userEvent.click(screen.getByRole('checkbox', {name: 'Xbox'}));
    const quota = screen.getByRole('spinbutton', {name: 'GitHub Repo Invite Quota'});
    await userEvent.clear(quota);
    await userEvent.type(quota, '10');
    const dismissButtons = await screen.findAllByRole('button', {name: 'Dismiss'});
    await userEvent.click(dismissButtons[1]!);
    expect(screen.getAllByRole('button', {name: 'Dismiss'})).toHaveLength(1);
    await userEvent.click(screen.getByRole('button', {name: 'Save'}));

    await waitForModalToHide();
    expect(updateMock).toHaveBeenCalledWith(
      `/organizations/${organization.slug}/`,
      expect.objectContaining({
        method: 'PUT',
        data: {
          enabledConsolePlatforms: ['playstation', 'xbox'],
          consoleSdkInviteQuota: 10,
        },
      })
    );
    expect(revokeMock).toHaveBeenCalledWith(
      `/organizations/${organization.slug}/console-sdk-invites/`,
      expect.objectContaining({
        method: 'DELETE',
        data: {items: [{memberId: '1', platform: 'xbox'}]},
      })
    );
    expect(onSuccess).toHaveBeenCalled();
  });

  it('warns when platforms are enabled with a zero invite quota', async () => {
    openToggleConsolePlatformsModal({organization, onSuccess: jest.fn()});
    renderGlobalModal();

    const quota = await screen.findByRole('spinbutton', {
      name: 'GitHub Repo Invite Quota',
    });
    expect(screen.queryByText(/invite quota is set to 0/)).not.toBeInTheDocument();

    await userEvent.clear(quota);
    await userEvent.type(quota, '0');
    expect(screen.getByText(/invite quota is set to 0/)).toBeInTheDocument();
  });

  it('keeps the modal open when saving fails', async () => {
    const onSuccess = jest.fn();
    const updateMock = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/`,
      method: 'PUT',
      statusCode: 400,
      body: {},
    });

    openToggleConsolePlatformsModal({organization, onSuccess});
    renderGlobalModal();

    await userEvent.click(await screen.findByRole('button', {name: 'Save'}));

    expect(
      await screen.findByText('Failed to update console SDK settings')
    ).toBeInTheDocument();
    expect(updateMock).toHaveBeenCalled();
    expect(onSuccess).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });
});
