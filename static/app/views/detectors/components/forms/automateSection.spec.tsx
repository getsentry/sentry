import {AutomationFixture} from 'sentry-fixture/automations';
import {MemberFixture} from 'sentry-fixture/member';
import {ProjectFixture} from 'sentry-fixture/project';
import {UserFixture} from 'sentry-fixture/user';
import {
  ActionHandlerFixture,
  DataConditionHandlerFixture,
} from 'sentry-fixture/workflowEngine';

import {
  render,
  screen,
  userEvent,
  waitFor,
  within,
} from 'sentry-test/reactTestingLibrary';
import selectEvent from 'sentry-test/selectEvent';

import Form from 'sentry/components/forms/form';
import {ActionGroup, ActionType} from 'sentry/types/workflowEngine/actions';
import {
  DataConditionHandlerGroupType,
  DataConditionHandlerSubgroupType,
  DataConditionType,
} from 'sentry/types/workflowEngine/dataConditions';
import {DetectorFormProvider} from 'sentry/views/detectors/components/forms/context';

import {AutomateSection} from './automateSection';

describe('AutomateSection', () => {
  const automation1 = AutomationFixture();
  const project = ProjectFixture({id: '1', slug: 'test-project'});
  const mockMember = MemberFixture({
    user: UserFixture({id: '1', name: 'Test User', email: 'test@sentry.io'}),
  });

  beforeEach(() => {
    jest.resetAllMocks();
    MockApiClient.clearMockResponses();

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/workflows/',
      method: 'GET',
      match: [MockApiClient.matchQuery({ids: [automation1.id]})],
      body: [automation1],
    });

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/workflows/',
      method: 'GET',
      body: [automation1],
    });

    // Mocks for AutomationBuilderDrawerForm
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/available-actions/',
      method: 'GET',
      body: [
        ActionHandlerFixture({
          type: ActionType.SLACK,
          handlerGroup: ActionGroup.NOTIFICATION,
          integrations: [{id: '1', name: 'My Slack Workspace'}],
        }),
        ActionHandlerFixture({
          type: ActionType.EMAIL,
          handlerGroup: ActionGroup.NOTIFICATION,
          integrations: [],
        }),
      ],
    });

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/tags/',
      method: 'GET',
      body: [],
    });

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/data-conditions/',
      method: 'GET',
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
      method: 'GET',
      match: [
        MockApiClient.matchQuery({group: DataConditionHandlerGroupType.WORKFLOW_TRIGGER}),
      ],
      body: [
        DataConditionHandlerFixture({
          handlerGroup: DataConditionHandlerGroupType.WORKFLOW_TRIGGER,
        }),
      ],
    });

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/users/',
      method: 'GET',
      body: [mockMember],
    });

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/members/',
      method: 'GET',
      body: [mockMember],
    });

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/detectors/',
      method: 'GET',
      body: [],
    });

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/projects/',
      method: 'GET',
      body: [project],
    });
  });

  it('can connect an existing automation', async () => {
    render(
      <DetectorFormProvider detectorType="metric_issue" project={project}>
        <Form>
          <AutomateSection />
        </Form>
      </DetectorFormProvider>
    );

    expect(screen.getByText('Alert')).toBeInTheDocument();

    await userEvent.click(screen.getByText('Connect Existing Alerts'));

    const drawer = await screen.findByRole('complementary', {
      name: 'Connect Alerts',
    });

    await within(drawer).findByText(automation1.name);

    const connectedAutomationsList = await screen.findByTestId(
      'drawer-connected-automations-list'
    );
    const allAutomationsList = await screen.findByTestId('drawer-all-automations-list');

    expect(within(allAutomationsList).getByText(automation1.name)).toBeInTheDocument();

    // Clicking connect should add the automation to the connected list
    await userEvent.click(within(drawer).getByRole('button', {name: 'Connect'}));
    await waitFor(() => {
      expect(
        within(connectedAutomationsList).getByText(automation1.name)
      ).toBeInTheDocument();
    });
  });

  it('can disconnect an existing automation', async () => {
    render(
      <DetectorFormProvider detectorType="metric_issue" project={project}>
        <Form initialData={{workflowIds: [automation1.id]}}>
          <AutomateSection />
        </Form>
      </DetectorFormProvider>
    );

    // Should display automation as connected
    expect(screen.getByText('Connected Alerts')).toBeInTheDocument();
    expect(await screen.findByText(automation1.name)).toBeInTheDocument();

    await userEvent.click(screen.getByText('Edit Alerts'));
    const drawer = await screen.findByRole('complementary', {
      name: 'Connect Alerts',
    });

    const connectedAutomationsList = await screen.findByTestId(
      'drawer-connected-automations-list'
    );
    expect(
      within(connectedAutomationsList).getByText(automation1.name)
    ).toBeInTheDocument();

    // Clicking disconnect should remove the automation from the connected list
    await userEvent.click(
      within(drawer).getAllByRole('button', {name: 'Disconnect'})[0]!
    );
    await waitFor(() => {
      expect(
        within(connectedAutomationsList).queryByText(automation1.name)
      ).not.toBeInTheDocument();
    });
  });

  it('can create a new alert and add it to connected alerts', async () => {
    const newAutomation = AutomationFixture({id: '999', name: 'My New Alert'});

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/workflows/',
      method: 'POST',
      body: newAutomation,
    });

    // Mock for fetching the newly created automation
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/workflows/',
      method: 'GET',
      match: [MockApiClient.matchQuery({id: [newAutomation.id]})],
      body: [newAutomation],
    });

    render(
      <DetectorFormProvider detectorType="metric_issue" project={project}>
        <Form>
          <AutomateSection />
        </Form>
      </DetectorFormProvider>
    );

    // Click "Create New Alert" button
    await userEvent.click(screen.getByRole('button', {name: 'Create New Alert'}));

    // Wait for the drawer to open
    const drawer = await screen.findByRole('complementary', {
      name: 'Create New Alert',
    });

    // Add an action to make the form valid
    await selectEvent.select(
      within(drawer).getByRole('textbox', {name: 'Add action'}),
      'Slack'
    );
    await userEvent.type(
      within(drawer).getByRole('textbox', {name: 'Target'}),
      '#alerts'
    );

    // Fill in the automation name
    const nameInput = within(drawer).getByRole('textbox', {name: 'Alert Name'});
    await userEvent.clear(nameInput);
    await userEvent.type(nameInput, 'My New Alert');

    // Submit the form
    await userEvent.click(within(drawer).getByRole('button', {name: 'Create Alert'}));

    // Wait for the drawer to close and the new automation to appear in the connected list
    await waitFor(() => {
      expect(
        screen.queryByRole('complementary', {name: 'Create New Alert'})
      ).not.toBeInTheDocument();
    });

    // The new automation should appear in the connected alerts section
    expect(await screen.findByText('Connected Alerts')).toBeInTheDocument();
    expect(await screen.findByText('My New Alert')).toBeInTheDocument();
  });
});
