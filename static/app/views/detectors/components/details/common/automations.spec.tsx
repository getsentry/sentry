import {AutomationFixture} from 'sentry-fixture/automations';
import {
  IssueStreamDetectorFixture,
  UptimeDetectorFixture,
} from 'sentry-fixture/detectors';
import {MemberFixture} from 'sentry-fixture/member';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';
import {UserFixture} from 'sentry-fixture/user';
import {
  ActionHandlerFixture,
  DataConditionHandlerFixture,
} from 'sentry-fixture/workflowEngine';

import {
  act,
  render,
  screen,
  userEvent,
  waitFor,
  within,
} from 'sentry-test/reactTestingLibrary';
import {selectEvent} from 'sentry-test/selectEvent';

import {ProjectsStore} from 'sentry/stores/projectsStore';
import {ActionGroup, ActionType} from 'sentry/types/workflowEngine/actions';
import {
  DataConditionHandlerGroupType,
  DataConditionHandlerSubgroupType,
  DataConditionType,
} from 'sentry/types/workflowEngine/dataConditions';

import {DetectorDetailsAutomations} from './automations';

describe('DetectorDetailsAutomations', () => {
  const organization = OrganizationFixture();
  const automation1 = AutomationFixture({id: '1', name: 'Alert 1'});
  const issueStreamDetector = IssueStreamDetectorFixture({id: '4'});

  const project = ProjectFixture({id: '1'});
  const mockMember = MemberFixture({
    user: UserFixture({id: '1', name: 'Test User', email: 'test@sentry.io'}),
  });

  beforeEach(() => {
    jest.clearAllMocks();
    MockApiClient.clearMockResponses();
    ProjectsStore.loadInitialData([project]);

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

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/available-actions/',
      body: [
        ActionHandlerFixture({
          type: ActionType.SLACK,
          handlerGroup: ActionGroup.NOTIFICATION,
          integrations: [{id: '1', name: 'My Slack Workspace'}],
        }),
      ],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/tags/',
      body: [],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/data-conditions/',
      match: [
        MockApiClient.matchQuery({group: DataConditionHandlerGroupType.ACTION_FILTER}),
      ],
      body: [
        DataConditionHandlerFixture({
          handlerGroup: DataConditionHandlerGroupType.ACTION_FILTER,
          handlerSubgroup: DataConditionHandlerSubgroupType.ISSUE_ATTRIBUTES,
          type: DataConditionType.TAGGED_EVENT,
        }),
      ],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/data-conditions/',
      match: [
        MockApiClient.matchQuery({
          group: DataConditionHandlerGroupType.WORKFLOW_TRIGGER,
        }),
      ],
      body: [
        DataConditionHandlerFixture({
          handlerGroup: DataConditionHandlerGroupType.WORKFLOW_TRIGGER,
        }),
      ],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/users/',
      body: [mockMember],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/members/',
      body: [mockMember],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/projects/',
      body: [],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/detectors/',
      body: [],
      match: [(_url, options) => options.query?.query !== 'type:issue_stream'],
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
          // Sorted desc by default: prioritize workflows connected to the monitor detector
          priorityDetector: detector.id,
        }),
      })
    );
  });

  it('can sort triggered by issues column', async () => {
    const automation2 = AutomationFixture({id: '2', name: 'Alert 2'});
    const detector = UptimeDetectorFixture({
      workflowIds: [automation1.id, automation2.id],
    });

    const descRequest = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/workflows/',
      method: 'GET',
      body: [automation1, automation2],
      match: [
        (_url, options) =>
          options.query?.priorityDetector === detector.id &&
          Array.isArray(options.query?.detector),
      ],
    });

    const ascRequest = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/workflows/',
      method: 'GET',
      body: [automation2, automation1],
      match: [
        (_url, options) =>
          options.query?.priorityDetector === issueStreamDetector.id &&
          Array.isArray(options.query?.detector),
      ],
    });

    render(<DetectorDetailsAutomations detector={detector} />, {organization});

    expect(await screen.findByRole('link', {name: automation1.name})).toBeInTheDocument();
    await waitFor(() => expect(descRequest).toHaveBeenCalled());

    const initialLinks = screen.getAllByRole('link', {name: /Alert/});
    expect(initialLinks[0]).toHaveTextContent(automation1.name);

    await userEvent.click(
      screen.getByRole('columnheader', {name: 'Triggered By Issues'})
    );

    await waitFor(() => expect(ascRequest).toHaveBeenCalled());

    const sortedLinks = await screen.findAllByRole('link', {name: /Alert/});
    expect(sortedLinks[0]).toHaveTextContent(automation2.name);
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

    expect(screen.getByRole('button', {name: 'Create a New Alert'})).toBeInTheDocument();
  });

  it('can search connected alerts', async () => {
    const automation2 = AutomationFixture({id: '2', name: 'Alert 2'});
    const detector = UptimeDetectorFixture({
      workflowIds: [automation1.id, automation2.id],
    });

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/workflows/',
      method: 'GET',
      body: [automation1, automation2],
      match: [
        (_url, options) =>
          options.query?.detector !== undefined && options.query?.query === undefined,
      ],
    });

    const searchRequest = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/workflows/',
      method: 'GET',
      body: [automation2],
      match: [
        (_url, options) =>
          options.query?.detector !== undefined &&
          typeof options.query?.query === 'string' &&
          options.query.query.includes('Alert 2'),
      ],
    });

    render(<DetectorDetailsAutomations detector={detector} />, {organization});

    expect(await screen.findByText(automation1.name)).toBeInTheDocument();

    const searchInput = screen.getByRole('combobox', {name: 'Add a search term'});
    await userEvent.click(searchInput);
    await userEvent.keyboard('Alert 2{Enter}');

    await waitFor(() => expect(searchRequest).toHaveBeenCalled());
    expect(await screen.findByRole('link', {name: automation2.name})).toBeInTheDocument();
    expect(screen.queryByRole('link', {name: automation1.name})).not.toBeInTheDocument();
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

  it('can create a new alert from drawer', async () => {
    const detector = UptimeDetectorFixture({
      id: 'detector-123',
      workflowIds: [automation1.id],
    });

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/workflows/',
      method: 'GET',
      body: [automation1],
    });

    const createdAutomation = AutomationFixture({id: 'new-alert-1'});
    const createRequest = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/workflows/',
      method: 'POST',
      body: createdAutomation,
    });

    render(<DetectorDetailsAutomations detector={detector} />, {organization});

    // Click the "New Alert" button in the header
    await userEvent.click(await screen.findByRole('button', {name: 'New Alert'}));

    // Fill in the drawer form — add an action
    await selectEvent.select(
      await screen.findByRole('textbox', {name: 'Add action'}),
      'Slack'
    );
    await userEvent.type(screen.getByRole('textbox', {name: 'Target'}), '#alerts');

    // Set the alert name
    const nameInput = screen.getByRole('textbox', {name: 'Alert Name'});
    await userEvent.clear(nameInput);
    await userEvent.type(nameInput, 'My New Alert');

    // Submit
    await userEvent.click(screen.getByRole('button', {name: 'Create Alert'}));

    // Verify the automation was created with the detector ID
    await waitFor(() => {
      expect(createRequest).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          method: 'POST',
          data: expect.objectContaining({
            name: 'My New Alert',
            detectorIds: [detector.id],
          }),
        })
      );
    });
  }, 10_000);

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

    await userEvent.click(await screen.findByRole('button', {name: 'Edit Alerts'}));

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
      ProjectsStore.loadInitialData([projectWithoutAlertsWrite]);

      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/workflows/',
        method: 'GET',
        body: [automation1],
      });

      render(<DetectorDetailsAutomations detector={detector} />, {
        organization: orgWithoutAlertsWrite,
      });

      const editButton = await screen.findByRole('button', {
        name: 'Edit Alerts',
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
      expect(createButton).toBeDisabled();
    });
  });
});
