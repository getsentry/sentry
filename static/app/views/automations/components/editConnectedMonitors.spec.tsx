import {MetricDetectorFixture} from 'sentry-fixture/detectors';

import {
  render,
  screen,
  userEvent,
  waitFor,
  within,
} from 'sentry-test/reactTestingLibrary';

import EditConnectedMonitors from './editConnectedMonitors';

describe('EditConnectedMonitors', function () {
  const detector1 = MetricDetectorFixture({
    id: '1',
    name: 'Metric Monitor 1',
    type: 'metric_issue',
  });

  beforeEach(() => {
    jest.resetAllMocks();
    MockApiClient.clearMockResponses();

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/detectors/',
      method: 'GET',
      body: [detector1],
    });
  });

  it('can connect an existing monitor', async function () {
    const setConnectedIds = jest.fn();
    render(
      <EditConnectedMonitors connectedIds={new Set()} setConnectedIds={setConnectedIds} />
    );

    expect(screen.getByText('Connected Monitors')).toBeInTheDocument();

    await userEvent.click(screen.getByText('Connect Monitors'));

    const drawer = await screen.findByRole('complementary', {
      name: 'Connect Monitors',
    });

    await within(drawer).findByText(detector1.name);

    const allMonitorsList = await screen.findByTestId('drawer-all-monitors-list');

    expect(within(allMonitorsList).getByText(detector1.name)).toBeInTheDocument();

    // Clicking connect should add the automation to the connected list
    await userEvent.click(within(drawer).getByRole('button', {name: 'Connect'}));
    const connectedMonitorsList = await screen.findByTestId(
      'drawer-connected-monitors-list'
    );
    expect(within(connectedMonitorsList).getByText(detector1.name)).toBeInTheDocument();

    expect(setConnectedIds).toHaveBeenCalledWith(new Set([detector1.id]));
  });

  it('can disconnect an existing monitor', async function () {
    const setConnectedIds = jest.fn();
    render(
      <EditConnectedMonitors
        connectedIds={new Set([detector1.id])}
        setConnectedIds={setConnectedIds}
      />
    );

    // Should display automation as connected
    expect(screen.getByText('Connected Monitors')).toBeInTheDocument();
    expect(await screen.findByText(detector1.name)).toBeInTheDocument();

    await userEvent.click(screen.getByText('Edit Monitors'));
    const drawer = await screen.findByRole('complementary', {
      name: 'Connect Monitors',
    });

    const connectedMonitorsList = await screen.findByTestId(
      'drawer-connected-monitors-list'
    );
    expect(within(connectedMonitorsList).getByText(detector1.name)).toBeInTheDocument();

    // Clicking disconnect should remove the automation from the connected list
    await userEvent.click(
      within(drawer).getAllByRole('button', {name: 'Disconnect'})[0]!
    );
    await waitFor(() => {
      expect(
        screen.queryByTestId('drawer-connected-monitors-list')
      ).not.toBeInTheDocument();
    });

    expect(setConnectedIds).toHaveBeenCalledWith(new Set());
  });
});
