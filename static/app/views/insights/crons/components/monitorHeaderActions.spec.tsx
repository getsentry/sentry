import {MonitorFixture} from 'sentry-fixture/monitor';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import MonitorHeaderActions from 'sentry/views/insights/crons/components/monitorHeaderActions';

describe('MonitorHeaderActions', () => {
  const organization = OrganizationFixture();

  it('disables mute button when monitor has no environments', async () => {
    const monitor = MonitorFixture({
      environments: [],
    });

    render(
      <MonitorHeaderActions
        monitor={monitor}
        orgSlug={organization.slug}
        onUpdate={jest.fn()}
      />,
      {organization}
    );

    const muteButton = screen.getByRole('button', {name: 'Mute'});
    expect(muteButton).toBeDisabled();

    await userEvent.hover(muteButton);
    expect(
      await screen.findByText(
        'Muting is only available when there are monitor environments'
      )
    ).toBeInTheDocument();
  });

  it('enables mute button when monitor has environments', async () => {
    const monitor = MonitorFixture();

    const updateMock = MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${monitor.project.slug}/monitors/${monitor.slug}/`,
      method: 'PUT',
      body: {...monitor, isMuted: true},
    });

    render(
      <MonitorHeaderActions
        monitor={monitor}
        orgSlug={organization.slug}
        onUpdate={jest.fn()}
      />,
      {organization}
    );

    const muteButton = screen.getByRole('button', {name: 'Mute'});
    expect(muteButton).toBeEnabled();

    await userEvent.click(muteButton);
    expect(updateMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        data: {isMuted: true},
      })
    );
  });

  it('shows unmute button when monitor is muted', () => {
    const monitor = MonitorFixture({
      isMuted: true,
    });

    render(
      <MonitorHeaderActions
        monitor={monitor}
        orgSlug={organization.slug}
        onUpdate={jest.fn()}
      />,
      {organization}
    );

    expect(screen.getByRole('button', {name: 'Unmute'})).toBeInTheDocument();
  });
});
