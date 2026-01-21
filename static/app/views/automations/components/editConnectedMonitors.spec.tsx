import {
  IssueStreamDetectorFixture,
  MetricDetectorFixture,
} from 'sentry-fixture/detectors';
import {PageFiltersFixture} from 'sentry-fixture/pageFilters';
import {ProjectFixture} from 'sentry-fixture/project';

import {
  render,
  screen,
  userEvent,
  waitFor,
  within,
} from 'sentry-test/reactTestingLibrary';

import Form from 'sentry/components/forms/form';
import FormModel from 'sentry/components/forms/model';
import PageFiltersStore from 'sentry/stores/pageFiltersStore';
import ProjectsStore from 'sentry/stores/projectsStore';

import EditConnectedMonitors from './editConnectedMonitors';

describe('EditConnectedMonitors', () => {
  const project = ProjectFixture({id: '1', slug: 'test-project'});
  const detector1 = MetricDetectorFixture({
    id: '1',
    name: 'Metric Monitor 1',
    type: 'metric_issue',
    projectId: project.id,
  });
  const issueStreamDetector = IssueStreamDetectorFixture({
    id: '100',
    name: 'Issue Stream Detector',
    projectId: project.id,
  });

  beforeEach(() => {
    jest.resetAllMocks();
    MockApiClient.clearMockResponses();
    ProjectsStore.loadInitialData([project]);

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/detectors/',
      method: 'GET',
      body: [detector1],
    });
    PageFiltersStore.onInitializeUrlState(PageFiltersFixture({projects: [1]}));
  });

  it('renders radio buttons for monitor selection mode', async () => {
    const setConnectedIds = jest.fn();
    render(<EditConnectedMonitors connectedIds={[]} setConnectedIds={setConnectedIds} />);

    expect(screen.getByText('Source')).toBeInTheDocument();
    expect(
      await screen.findByRole('radio', {name: 'Alert on all issues in selected projects'})
    ).toBeInTheDocument();
    expect(
      screen.getByRole('radio', {name: 'Alert on specific monitors'})
    ).toBeInTheDocument();
  });

  it('defaults to "all project issues" mode when no monitors are connected', async () => {
    const setConnectedIds = jest.fn();
    render(<EditConnectedMonitors connectedIds={[]} setConnectedIds={setConnectedIds} />);

    expect(
      await screen.findByRole('radio', {name: 'Alert on all issues in selected projects'})
    ).toBeChecked();
    expect(
      screen.getByRole('radio', {name: 'Alert on specific monitors'})
    ).not.toBeChecked();

    // Should show project selector
    expect(screen.getByText('Projects')).toBeInTheDocument();
    expect(screen.getByText('Select projects')).toBeInTheDocument();
  });

  it('can connect an existing monitor via specific monitors mode', async () => {
    const setConnectedIds = jest.fn();
    render(<EditConnectedMonitors connectedIds={[]} setConnectedIds={setConnectedIds} />);

    expect(screen.getByText('Source')).toBeInTheDocument();

    // Switch to specific monitors mode
    await userEvent.click(
      screen.getByRole('radio', {name: 'Alert on specific monitors'})
    );

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

    expect(setConnectedIds).toHaveBeenCalledWith([detector1.id]);
  });

  it('can disconnect an existing monitor', async () => {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/detectors/',
      method: 'GET',
      body: [detector1],
      match: [MockApiClient.matchQuery({id: [detector1.id]})],
    });
    // Mock for issue stream detectors (detector1 is not an issue stream detector)
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/detectors/',
      method: 'GET',
      body: [],
      match: [MockApiClient.matchQuery({query: 'type:issue_stream'})],
    });

    const setConnectedIds = jest.fn();
    render(
      <EditConnectedMonitors
        connectedIds={[detector1.id]}
        setConnectedIds={setConnectedIds}
      />
    );

    // Wait for the initial mode to be determined (should be specific monitors since detector1 is not issue_stream)
    await screen.findByRole('radio', {name: 'Alert on specific monitors'});

    // Should display automation as connected
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
        within(connectedMonitorsList).queryByText(detector1.name)
      ).not.toBeInTheDocument();
    });

    expect(setConnectedIds).toHaveBeenCalledWith([]);
  });

  it('shows "all project issues" mode when connected to an issue_stream detector', async () => {
    // Mock for getting the connected detector by ID
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/detectors/',
      method: 'GET',
      body: [issueStreamDetector],
      match: [MockApiClient.matchQuery({id: [issueStreamDetector.id]})],
    });
    // Mock for getting all issue stream detectors (used to determine initial mode)
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/detectors/',
      method: 'GET',
      body: [issueStreamDetector],
      match: [MockApiClient.matchQuery({query: 'type:issue_stream'})],
    });

    const setConnectedIds = jest.fn();
    render(
      <EditConnectedMonitors
        connectedIds={[issueStreamDetector.id]}
        setConnectedIds={setConnectedIds}
      />
    );

    // Wait for the initial mode to be determined
    await waitFor(() => {
      expect(
        screen.getByRole('radio', {name: 'Alert on all issues in selected projects'})
      ).toBeChecked();
    });
  });

  it('switches between modes correctly', async () => {
    const setConnectedIds = jest.fn();
    render(<EditConnectedMonitors connectedIds={[]} setConnectedIds={setConnectedIds} />);

    // Initially in "all project issues" mode
    expect(
      await screen.findByRole('radio', {name: 'Alert on all issues in selected projects'})
    ).toBeChecked();

    // Switch to specific monitors mode
    await userEvent.click(
      screen.getByRole('radio', {name: 'Alert on specific monitors'})
    );

    expect(screen.getByRole('radio', {name: 'Alert on specific monitors'})).toBeChecked();
    expect(screen.getByText('Connect Monitors')).toBeInTheDocument();

    // Switch back to all project issues mode
    await userEvent.click(
      screen.getByRole('radio', {name: 'Alert on all issues in selected projects'})
    );

    expect(
      screen.getByRole('radio', {name: 'Alert on all issues in selected projects'})
    ).toBeChecked();
  });

  it('updates connected detector ids when project is selected', async () => {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/detectors/',
      method: 'GET',
      body: [issueStreamDetector],
      match: [MockApiClient.matchQuery({query: 'type:issue_stream'})],
    });

    const model = new FormModel();
    model.setInitialData({projectIds: [], detectorIds: []});

    const setConnectedIds = jest.fn();
    render(
      <Form model={model}>
        <EditConnectedMonitors connectedIds={[]} setConnectedIds={setConnectedIds} />
      </Form>
    );

    // Wait for project selector to be available
    await screen.findByText('Projects');

    // Open the project selector dropdown
    await userEvent.click(screen.getByText('Select projects'));

    // Select a project
    await userEvent.click(await screen.findByText(project.slug));

    // The onChange should be called with the selected project ID
    await waitFor(() => {
      expect(setConnectedIds).toHaveBeenCalledWith([issueStreamDetector.id]);
    });
  });
});
