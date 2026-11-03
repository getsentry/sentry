import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {trackAnalytics} from 'sentry/utils/analytics';
import {ExtrapolationEnabledAlert} from 'sentry/views/explore/spans/extrapolationEnabledAlert';
import {SettingsDropdown} from 'sentry/views/explore/spans/settingsDropdown';
import {SpansQueryParamsProvider} from 'sentry/views/explore/spans/spansQueryParamsProvider';

jest.mock('sentry/utils/analytics');

describe('SettingsDropdown', () => {
  const organization = OrganizationFixture({id: '123'});

  beforeEach(() => {
    jest.mocked(trackAnalytics).mockClear();
  });

  function renderComponents() {
    return render(
      <SpansQueryParamsProvider>
        <SettingsDropdown />
        <ExtrapolationEnabledAlert />
      </SpansQueryParamsProvider>,
      {organization}
    );
  }

  it('tracks disabling and re-enabling extrapolation from the dropdown', async () => {
    renderComponents();

    await userEvent.click(screen.getByRole('button', {name: 'Settings'}));
    await userEvent.click(
      await screen.findByRole('menuitemradio', {name: 'Disable Extrapolation'})
    );

    expect(trackAnalytics).toHaveBeenCalledWith('trace.explorer.extrapolation_toggled', {
      organization,
      organization_id: '123',
      enabled: false,
      source: 'settings_dropdown',
    });

    await userEvent.click(screen.getByRole('button', {name: 'Settings'}));
    await userEvent.click(
      await screen.findByRole('menuitemradio', {name: 'Enable Extrapolation'})
    );

    expect(trackAnalytics).toHaveBeenCalledWith('trace.explorer.extrapolation_toggled', {
      organization,
      organization_id: '123',
      enabled: true,
      source: 'settings_dropdown',
    });
  });

  it('tracks re-enabling extrapolation from the disabled alert', async () => {
    renderComponents();

    await userEvent.click(screen.getByRole('button', {name: 'Settings'}));
    await userEvent.click(
      await screen.findByRole('menuitemradio', {name: 'Disable Extrapolation'})
    );
    jest.mocked(trackAnalytics).mockClear();

    await userEvent.click(await screen.findByRole('button', {name: 'Re-enable'}));

    expect(trackAnalytics).toHaveBeenCalledWith('trace.explorer.extrapolation_toggled', {
      organization,
      organization_id: '123',
      enabled: true,
      source: 'disabled_alert',
    });
    expect(screen.queryByRole('button', {name: 'Re-enable'})).not.toBeInTheDocument();
  });
});
