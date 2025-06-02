import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {MonitorsDropdown} from './monitorsDropdown';

describe('MonitorsDropdown', function () {
  beforeEach(function () {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/monitors-count/',
      body: {
        counts: {active: 2, disabled: 1, total: 4},
      },
    });

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/uptime-count/',
      body: {
        counts: {active: 1, disabled: 2, total: 3},
      },
    });
  });

  it('displays correct counts and links', async function () {
    render(<MonitorsDropdown />);

    const dropdown = await screen.findByRole('button', {name: '7 Monitors'});

    await userEvent.click(dropdown);

    expect(
      await screen.findByRole('menuitemradio', {name: /2 Active Cron Monitors/})
    ).toHaveAttribute('href', '/organizations/org-slug/insights/crons/');
    expect(
      await screen.findByRole('menuitemradio', {name: /1 Active Uptime Monitor/})
    ).toHaveAttribute('href', '/organizations/org-slug/insights/uptime/');
  });
});
