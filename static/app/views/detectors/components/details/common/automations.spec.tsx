import {AutomationFixture} from 'sentry-fixture/automations';
import {
  IssueStreamDetectorFixture,
  UptimeDetectorFixture,
} from 'sentry-fixture/detectors';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';

import {
  act,
  render,
  screen,
  userEvent,
  waitFor,
  within,
} from 'sentry-test/reactTestingLibrary';

import ProjectsStore from 'sentry/stores/projectsStore';

import {DetectorDetailsAutomations} from './automations';

describe('DetectorDetailsAutomations', () => {
  const organization = OrganizationFixture();
  const automation1 = AutomationFixture({id: '1', name: 'Alert 1'});
  const issueStreamDetector = IssueStreamDetectorFixture({id: 'issue-stream-1'});

  beforeEach(() => {
    jest.resetAllMocks();
    MockApiClient.clearMockResponses();

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/detectors/',
      method: 'GET',
      body: [issueStreamDetector],
      match: [
        MockApiClient.matchQuery({
          query: 'type:issue_stream',
          project: [1],
        }),
      ],
    });
  });

  it('renders connected alerts list', async () => {
    const detector = UptimeDetectorFixture({
      workflowIds: [automation1.id],
    });

    const workflowsMock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/workflows/',
      method: 'GET',
      body: [automation1],
    });

    render(<DetectorDetailsAutomations detector={detector} />, {organization});

    expect(screen.getByText('Connected Alerts')).toBeInTheDocument();
    expect(await screen.findByText(automation1.name)).toBeInTheDocument();

    expect(workflowsMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        query: expect.objectContaining({
          // Should query for both the issue stream detector of the project and the detector itself
          detector: [detector.id, issueStreamDetector.id],
        }),
      })
    );
  });

  it('renders empty state when no alerts are connected', async () => {
    const detector = UptimeDetectorFixture({
      workflowIds: [],
    });

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/workflows/',
      method: 'GET',
      body: [],
    });

    render(<DetectorDetailsAutomations detector={detector} />, {organization});

    expect(
      await screen.findByRole('button', {name: 'Connect Existing Alerts'})
    ).toBeInTheDocument();

    // Shows create new alert link to new alert page and a prefilled connectedIds
    const createButton = screen.getByRole('button', {name: 'Create a New Alert'});
    expect(createButton).toHaveAttribute(
      'href',
      `/organizations/org-slug/monitors/alerts/new/?connectedIds=${detector.id}`
    );
  });

  it('can connect a new automation from drawer', async () => {
    const detector = UptimeDetectorFixture({
      id: 'detector-123',
      workflowIds: [],
    });

    // Mock the table query (has detector param) to return empty
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/workflows/',
      method: 'GET',
      body: [],
      match: [(_url, options) => options.query?.detector !== undefined],
    });

    // Mock the drawer's all automations query (no detector param)
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/workflows/',
      method: 'GET',
      body: [automation1],
      match: [(_url, options) => options.query?.detector === undefined],
    });

    const updateRequest = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/detectors/detector-123/',
      method: 'PUT',
      body: {...detector, workflowIds: [automation1.id]},
    });

    render(<DetectorDetailsAutomations detector={detector} />, {organization});

    await userEvent.click(
      await screen.findByRole('button', {name: 'Connect Existing Alerts'})
    );

    const drawer = await screen.findByRole('complementary', {name: 'Connect Alerts'});

    const allAutomationsList = await screen.findByTestId('drawer-all-automations-list');
    expect(
      await within(allAutomationsList).findByText(automation1.name)
    ).toBeInTheDocument();

    await userEvent.click(within(drawer).getByRole('button', {name: 'Connect'}));

    await waitFor(() => {
      expect(updateRequest).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          method: 'PUT',
          data: {detectorId: 'detector-123', workflowIds: [automation1.id]},
        })
      );
    });
  });

  it('can disconnect an automation from drawer', async () => {
    const detector = UptimeDetectorFixture({
      id: 'detector-123',
      workflowIds: [automation1.id],
    });

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/workflows/',
      method: 'GET',
      body: [automation1],
    });

    const updateRequest = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/detectors/detector-123/',
      method: 'PUT',
      body: {...detector, workflowIds: []},
    });

    render(<DetectorDetailsAutomations detector={detector} />, {organization});

    await userEvent.click(
      await screen.findByRole('button', {name: 'Edit Connected Alerts'})
    );

    const connectedAutomationsList = await screen.findByTestId(
      'drawer-connected-automations-list'
    );

    expect(
      within(connectedAutomationsList).getByText(automation1.name)
    ).toBeInTheDocument();

    const disconnectButtons = within(connectedAutomationsList).getAllByRole('button', {
      name: 'Disconnect',
    });
    await userEvent.click(disconnectButtons[0]!);

    await waitFor(() => {
      expect(updateRequest).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          method: 'PUT',
          data: {detectorId: 'detector-123', workflowIds: []},
        })
      );
    });
  });

  describe('permissions', () => {
    it('disables edit button when user lacks alerts:write permission', async () => {
      const orgWithoutAlertsWrite = OrganizationFixture({
        access: [],
      });
      const projectWithoutAlertsWrite = ProjectFixture({
        id: '1',
        access: [],
      });
      const detector = UptimeDetectorFixture({
        projectId: '1',
        workflowIds: [automation1.id],
      });

      act(() => ProjectsStore.loadInitialData([projectWithoutAlertsWrite]));

      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/workflows/',
        method: 'GET',
        body: [automation1],
      });

      render(<DetectorDetailsAutomations detector={detector} />, {
        organization: orgWithoutAlertsWrite,
      });

      const editButton = await screen.findByRole('button', {
        name: 'Edit Connected Alerts',
      });
      expect(editButton).toBeDisabled();
    });

    it('disables connect and create buttons in empty state when user lacks permission', async () => {
      const orgWithoutAlertsWrite = OrganizationFixture({
        access: [],
      });
      const projectWithoutAlertsWrite = ProjectFixture({
        id: '1',
        access: [],
      });
      const detector = UptimeDetectorFixture({
        projectId: '1',
        workflowIds: [],
      });

      act(() => ProjectsStore.loadInitialData([projectWithoutAlertsWrite]));

      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/workflows/',
        method: 'GET',
        body: [],
      });

      render(<DetectorDetailsAutomations detector={detector} />, {
        organization: orgWithoutAlertsWrite,
      });

      const connectButton = await screen.findByRole('button', {
        name: 'Connect Existing Alerts',
      });
      const createButton = screen.getByRole('button', {name: 'Create a New Alert'});

      expect(connectButton).toBeDisabled();
      expect(createButton).toHaveAttribute('aria-disabled', 'true');
    });
  });
});
