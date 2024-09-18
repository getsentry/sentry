import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import localStorage from 'sentry/utils/localStorage';
import {DiscoverSplitAlert} from 'sentry/views/dashboards/discoverSplitAlert';

describe('DiscoverSplitAlert', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('renders if there are forced widgets', async () => {
    render(<DiscoverSplitAlert hasForcedWidgets dashboardId="1" />);

    expect(
      screen.getByText(/We're splitting our Errors and Transactions dataset/)
    ).toBeInTheDocument();

    await userEvent.click(screen.getByLabelText('Close'));

    expect(
      screen.queryByText(/We're splitting our Errors and Transactions dataset/)
    ).not.toBeInTheDocument();
  });

  it('does not render if there are no forced widgets', () => {
    render(<DiscoverSplitAlert hasForcedWidgets={false} dashboardId="1" />);

    expect(
      screen.queryByText(/We're splitting our Errors and Transactions dataset/)
    ).not.toBeInTheDocument();
  });

  it('does not render if the alert has been dismissed', () => {
    localStorage.setItem('dashboard-discover-split-alert-dismissed-1', '1');

    render(<DiscoverSplitAlert hasForcedWidgets dashboardId="1" />);

    expect(
      screen.queryByText(/We're splitting our Errors and Transactions dataset/)
    ).not.toBeInTheDocument();
  });
});
