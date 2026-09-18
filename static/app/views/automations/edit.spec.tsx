import {
  ActionFilterFixture,
  AutomationFixture,
  DataConditionFixture,
} from 'sentry-fixture/automations';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ActionHandlerFixture} from 'sentry-fixture/workflowEngine';

import {
  render,
  renderGlobalModal,
  screen,
  userEvent,
  waitFor,
  within,
  type RouterConfig,
} from 'sentry-test/reactTestingLibrary';
import {selectEvent} from 'sentry-test/selectEvent';

import {ActionGroup, ActionType} from 'sentry/types/workflowEngine/actions';
import type {Automation} from 'sentry/types/workflowEngine/automations';
import {
  DataConditionGroupLogicType,
  DataConditionType,
} from 'sentry/types/workflowEngine/dataConditions';
import {trackAnalytics} from 'sentry/utils/analytics';
import {dataConditionNodesMap} from 'sentry/views/automations/components/dataConditionNodes';
import AutomationEdit from 'sentry/views/automations/edit';
import {useLLMContext} from 'sentry/views/seerExplorer/contexts/llmContext';

jest.mock('sentry/utils/analytics');

describe('EditAutomation', () => {
  const automation = AutomationFixture();
  const organization = OrganizationFixture();
  const initialRouterConfig = {
    routes: [
      '/organizations/:orgId/monitors/alerts/:automationId/',
      '/organizations/:orgId/monitors/alerts/:automationId/edit/',
    ],
    location: {
      pathname: `/organizations/${organization.slug}/monitors/alerts/${automation.id}/edit/`,
    },
  } satisfies RouterConfig;

  beforeEach(() => {
    MockApiClient.clearMockResponses();

    // Mock the GET request to fetch automation data
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/workflows/${automation.id}/`,
      method: 'GET',
      body: automation,
    });

    // Mock the detectors query (used by ConnectedMonitorsList)
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/detectors/`,
      method: 'GET',
      body: [],
    });

    // Mock the users query (used for assignee)
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/users/`,
      method: 'GET',
      body: [],
    });

    // Mock data conditions query
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/data-conditions/`,
      method: 'GET',
      body: [],
    });

    // Mock available actions query
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/available-actions/`,
      method: 'GET',
      body: [],
    });

    // Mock user query
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/users/${automation.createdBy}/`,
      method: 'GET',
      body: {id: automation.createdBy, name: 'Test User'},
    });

    // Mock the organization tags
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/tags/`,
      method: 'GET',
      body: [],
    });
  });

  it('displays `any` for ANY in the filter logic dropdown', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/workflows/${automation.id}/`,
      method: 'GET',
      body: {
        ...automation,
        actionFilters: [
          ActionFilterFixture({logicType: DataConditionGroupLogicType.ANY}),
        ],
      },
    });

    render(<AutomationEdit />, {organization, initialRouterConfig});

    // Wait for the form to load
    expect(await screen.findByRole('button', {name: 'Save'})).toBeInTheDocument();

    const filterLogicType = screen.getByTestId('action-filter-logic-type');
    expect(within(filterLogicType).getByText('any')).toBeInTheDocument();
  });

  it('calls delete mutation when deletion is confirmed', async () => {
    const mockDeleteAutomation = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/workflows/${automation.id}/`,
      method: 'DELETE',
    });

    const {router} = render(<AutomationEdit />, {organization, initialRouterConfig});
    renderGlobalModal();

    // Wait for the component to load and display the automation name
    expect(await screen.findByRole('button', {name: 'Delete'})).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', {name: 'Delete'}));

    // Confirm the deletion
    const dialog = await screen.findByRole('dialog');
    await userEvent.click(within(dialog).getByRole('button', {name: 'Delete'}));

    expect(mockDeleteAutomation).toHaveBeenCalledWith(
      `/organizations/${organization.slug}/workflows/${automation.id}/`,
      expect.anything()
    );

    // Redirect to the monitors list
    await waitFor(() =>
      expect(router.location.pathname).toBe(
        `/organizations/${organization.slug}/monitors/alerts/`
      )
    );
  });

  it('calls update mutation when enabling/disabling automation', async () => {
    const mockUpdateAutomation = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/workflows/${automation.id}/`,
      method: 'PUT',
      body: {...automation, enabled: !automation.enabled},
    });

    render(<AutomationEdit />, {organization, initialRouterConfig});

    // Wait for the component to load and display automation actions
    expect(await screen.findByRole('button', {name: 'Disable'})).toBeInTheDocument();

    // Click the toggle button to enable/disable the automation
    await userEvent.click(screen.getByRole('button', {name: 'Disable'}));

    // Verify the mutation was called with correct data
    await waitFor(() => {
      expect(mockUpdateAutomation).toHaveBeenCalledWith(
        `/organizations/${organization.slug}/workflows/${automation.id}/`,
        expect.objectContaining({
          data: {id: automation.id, name: automation.name, enabled: !automation.enabled},
        })
      );
    });

    // Verify the button text has changed to "Enable"
    expect(await screen.findByRole('button', {name: 'Enable'})).toBeInTheDocument();
  });

  it('updates automation', async () => {
    const mockUpdateAutomation = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/workflows/${automation.id}/`,
      method: 'PUT',
      body: automation,
    });

    const {router} = render(<AutomationEdit />, {organization, initialRouterConfig});

    // Update an existing filter value field
    const valueInput = await screen.findByRole('textbox', {name: 'Value'});
    await userEvent.clear(valueInput);
    await userEvent.type(valueInput, 'updated value');

    await userEvent.click(screen.getByRole('button', {name: 'Save'}));

    await waitFor(() => {
      expect(mockUpdateAutomation).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          data: expect.objectContaining({
            actionFilters: expect.arrayContaining([
              expect.objectContaining({
                conditions: expect.arrayContaining([
                  expect.objectContaining({
                    comparison: expect.objectContaining({value: 'updated value'}),
                  }),
                ]),
              }),
            ]),
          }),
        })
      );
    });

    expect(trackAnalytics).toHaveBeenCalledWith('automation.updated', {
      organization,
      frequency_minutes: 1440,
      environment: 'production',
      detectors_count: 1,
      trigger_conditions_count: 1,
      actions_count: 1,
      success: true,
    });

    await waitFor(() =>
      expect(router.location.pathname).toBe(
        `/organizations/${organization.slug}/monitors/alerts/${automation.id}/`
      )
    );
  });

  describe('breadcrumbs', () => {
    it('renders the parent crumb in the trail and the alert name as the page title', async () => {
      render(<AutomationEdit />, {organization, initialRouterConfig});

      const alertsCrumb = await screen.findByRole('link', {name: 'Alerts'});
      expect(alertsCrumb).toHaveAttribute(
        'href',
        `/organizations/${organization.slug}/monitors/alerts/`
      );

      expect(
        screen.getByRole('heading', {name: automation.name, level: 1})
      ).toBeInTheDocument();

      const trail = alertsCrumb.closest('ol')!;
      expect(within(trail).queryByText(automation.name)).not.toBeInTheDocument();
    });

    it('edits the alert name from the page title', async () => {
      render(<AutomationEdit />, {organization, initialRouterConfig});

      await userEvent.click(await screen.findByText(automation.name));

      const input = screen.getByRole('textbox', {name: 'Alert Name'});
      expect(input).toHaveValue(automation.name);

      await userEvent.clear(input);
      await userEvent.type(input, 'Renamed alert{enter}');

      expect(
        screen.getByRole('heading', {name: 'Renamed alert', level: 1})
      ).toBeInTheDocument();
    });
  });

  describe('initial trigger conditions', () => {
    const everyEventLabel = dataConditionNodesMap.get(
      DataConditionType.EVERY_EVENT
    )?.label;

    if (!everyEventLabel) {
      throw new Error('Every event label not found');
    }

    /**
     * Mock opening the edit form with the given triggers and saving it
     * Returns what the API received
     */
    async function getSubmittedTriggers(triggers: Automation['triggers']) {
      MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/workflows/${automation.id}/`,
        method: 'GET',
        body: {...automation, triggers},
      });

      const mockUpdateAutomation = MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/workflows/${automation.id}/`,
        method: 'PUT',
        body: automation,
      });

      render(<AutomationEdit />, {organization, initialRouterConfig});

      await userEvent.click(await screen.findByRole('button', {name: 'Save'}));

      await waitFor(() => expect(mockUpdateAutomation).toHaveBeenCalled());

      return mockUpdateAutomation.mock.calls[0][1].data.triggers;
    }

    it('adds an every_event trigger when the automation has no trigger conditions', async () => {
      const submittedTriggers = await getSubmittedTriggers({
        id: '1',
        logicType: DataConditionGroupLogicType.ANY,
        conditions: [],
      });

      expect(submittedTriggers).toEqual(
        expect.objectContaining({
          logicType: DataConditionGroupLogicType.ANY,
          conditions: [
            {
              type: DataConditionType.EVERY_EVENT,
              comparison: true,
              conditionResult: true,
            },
          ],
        })
      );

      expect(screen.getByText(everyEventLabel)).toBeInTheDocument();
    });

    it('adds an every_event trigger when the automation has no trigger group', async () => {
      const submittedTriggers = await getSubmittedTriggers(null);

      expect(submittedTriggers).toEqual(
        expect.objectContaining({
          logicType: DataConditionGroupLogicType.ANY_SHORT_CIRCUIT,
          conditions: [
            {
              type: DataConditionType.EVERY_EVENT,
              comparison: true,
              conditionResult: true,
            },
          ],
        })
      );

      expect(screen.getByText(everyEventLabel)).toBeInTheDocument();
    });

    it('leaves existing trigger conditions untouched', async () => {
      const submittedTriggers = await getSubmittedTriggers({
        id: '1',
        logicType: DataConditionGroupLogicType.ALL,
        conditions: [
          DataConditionFixture({
            type: DataConditionType.FIRST_SEEN_EVENT,
            comparison: true,
          }),
        ],
      });

      expect(submittedTriggers).toEqual(
        expect.objectContaining({
          logicType: DataConditionGroupLogicType.ALL,
          conditions: [{type: DataConditionType.FIRST_SEEN_EVENT, comparison: true}],
        })
      );

      const firstSeenEventText = dataConditionNodesMap.get(
        DataConditionType.FIRST_SEEN_EVENT
      )?.label;

      if (!firstSeenEventText) {
        throw new Error('First seen event text not found');
      }

      expect(screen.getByText(firstSeenEventText)).toBeInTheDocument();

      expect(screen.queryByText(everyEventLabel)).not.toBeInTheDocument();
    });
  });

  describe('Seer page context', () => {
    /**
     * Renders the edit page under a component that captures `getLLMContext`,
     * which is how Seer reads it. Returns a getter for the `alert-builder`
     * node.
     */
    function renderAndReadNode() {
      let getLLMContext: ReturnType<typeof useLLMContext>['getLLMContext'] | undefined;
      function Component() {
        // oxlint-disable-next-line react/globals -- Test captures the hook result in an outer variable to assert on it.
        ({getLLMContext} = useLLMContext());
        return <AutomationEdit />;
      }

      render(<Component />, {organization, initialRouterConfig});

      return () => getLLMContext!().nodes.find(node => node.nodeType === 'alert-builder');
    }

    it('reports an action added but not saved, with its target channel', async () => {
      MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/available-actions/`,
        method: 'GET',
        body: [
          ActionHandlerFixture({
            type: ActionType.SLACK,
            handlerGroup: ActionGroup.NOTIFICATION,
            integrations: [{id: 'slack-1', name: 'My Slack Workspace'}],
          }),
        ],
      });

      const readNode = renderAndReadNode();

      await selectEvent.select(
        await screen.findByRole('textbox', {name: 'Add action'}),
        'Slack'
      );
      // The saved alert already has a Slack action, so its Target box is on
      // screen too — the one just added is last.
      const targets = screen.getAllByRole('textbox', {name: 'Target'});
      await userEvent.click(targets.at(-1)!);
      await userEvent.paste('#alerts-prod');

      // Deliberately no save: the point is that Seer sees the alert as it is on
      // screen, before it is submitted.
      await waitFor(() => {
        const data = readNode()?.data as Record<string, unknown> | undefined;
        expect(data).toBeDefined();
        expect(data!.mode).toBe('editing');
        expect(data!.actionFilters).toEqual([
          expect.objectContaining({
            actions: expect.arrayContaining([
              expect.objectContaining({type: 'slack', targetDisplay: '#alerts-prod'}),
            ]),
          }),
        ]);
      });
    });

    it('reports triggers from the builder, not the saved alert', async () => {
      // The builder seeds an every_event trigger when the saved alert has no
      // trigger conditions, so the two disagree before the user touches
      // anything — which is exactly what the node has to report.
      MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/workflows/${automation.id}/`,
        method: 'GET',
        body: {
          ...automation,
          triggers: {id: '1', logicType: DataConditionGroupLogicType.ANY, conditions: []},
        },
      });

      const readNode = renderAndReadNode();

      await waitFor(() => {
        const node = readNode();
        expect(node).toBeDefined();
        // Outranks the page nodes rendered beside it.
        expect(node!.priority).toBe(1);
        expect((node!.data as Record<string, unknown>).triggers).toEqual({
          logicType: DataConditionGroupLogicType.ANY,
          conditions: [{type: DataConditionType.EVERY_EVENT, comparison: true}],
        });
      });
    });
  });
});
