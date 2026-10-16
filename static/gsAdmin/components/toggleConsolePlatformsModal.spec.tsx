import {OrganizationFixture} from 'sentry-fixture/organization';

import {
  renderGlobalModal,
  screen,
  userEvent,
  waitFor,
} from 'sentry-test/reactTestingLibrary';

import {openToggleConsolePlatformsModal} from 'admin/components/toggleConsolePlatformsModal';

describe('ToggleConsolePlatformsModal', () => {
  it('saves platform and invite quota changes from the modal footer', async () => {
    const organization = OrganizationFixture({
      enabledConsolePlatforms: [],
      consoleSdkInviteQuota: 0,
    });
    const onSuccess = jest.fn();
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/console-sdk-invites/`,
      method: 'GET',
      body: [],
    });
    const update = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/`,
      method: 'PUT',
      body: organization,
    });

    openToggleConsolePlatformsModal({organization, onSuccess});
    renderGlobalModal();

    await userEvent.click(screen.getByLabelText('PlayStation'));
    await userEvent.clear(
      screen.getByRole('spinbutton', {name: 'GitHub Repo Invite Quota'})
    );
    await userEvent.type(
      screen.getByRole('spinbutton', {name: 'GitHub Repo Invite Quota'}),
      '2'
    );
    await userEvent.click(screen.getByRole('button', {name: 'Save'}));

    await waitFor(() => expect(update).toHaveBeenCalled());
    expect(update).toHaveBeenCalledWith(
      `/organizations/${organization.slug}/`,
      expect.objectContaining({
        data: {
          enabledConsolePlatforms: ['playstation'],
          consoleSdkInviteQuota: 2,
        },
      })
    );
    await waitFor(() => expect(onSuccess).toHaveBeenCalled());
  });
});
