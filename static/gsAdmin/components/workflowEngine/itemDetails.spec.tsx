import {render, screen, userEvent, within} from 'sentry-test/reactTestingLibrary';

import type {WorkflowEngineDebuggerResponse} from 'sentry/utils/workflowEngineDebuggerApiOptions';

import {WorkflowEngineItemDetails} from './itemDetails';

type DebuggerItem = WorkflowEngineDebuggerResponse['item'];

const detector: DebuggerItem = {
  id: '501',
  name: 'Checkout errors',
  type: 'detector',
  organizationId: '1',
  projectId: '3',
  context: {
    id: '501',
    name: 'Checkout errors',
    type: 'error',
    enabled: false,
    status: 0,
    description: '',
    ownerUserId: null,
    internalNote: 'root-only-note',
    config: {threshold: 0, enabled: false, owner: null, nested: {description: ''}},
    projectOptions: {'sentry:resolve_age': 0, 'sentry:fingerprinting_rules': null},
    projectOptionSources: {
      'sentry:resolve_age': 'project_option',
      'sentry:fingerprinting_rules': 'unset',
    },
    futureScalar: 0,
    futureMetadata: {revision: 0, available: false, nested: [null, 'future-value']},
    conditionGroup: {
      id: '601',
      organizationId: '1',
      logicType: 'all',
      futureGroupField: 'group-only-value',
      conditions: [
        {
          id: '701',
          type: 'gt',
          comparison: 0,
          conditionResult: false,
          futureConditionField: {mode: 'condition-only-value', owner: null},
        },
      ],
      actions: [
        {
          id: '1101',
          type: 'slack',
          integrationId: '1201',
          status: 'active',
          config: {targetIdentifier: '#checkout', enabled: false},
          data: {tags: 'environment,release', count: 0},
          futureActionField: null,
        },
      ],
    },
    workflows: [
      {
        id: '801',
        name: 'Checkout notifications',
        enabled: true,
        futureWorkflowField: 'related-only-value',
      },
    ],
    dataSources: [{id: '901', type: 'subscription', sourceId: 'query-123'}],
    latestGroups: [{id: '1001', title: 'Checkout failed', priority: 0}],
    contextTruncated: false,
  },
};

async function copyFieldGroup(fields: HTMLElement, name: string) {
  await userEvent.click(
    within(within(fields).getByRole('region', {name})).getByRole('button', {
      name: 'Copy snippet',
    })
  );
  return JSON.parse(await navigator.clipboard.readText());
}

describe('WorkflowEngineItemDetails', () => {
  it('starts with connected entity summaries and every node collapsed', () => {
    render(<WorkflowEngineItemDetails item={detector} />);

    for (const name of [
      'Detector 501: Checkout errors',
      'Condition Group 601',
      'Condition 701',
      'Action 1101',
      'Workflow 801: Checkout notifications',
      'Data Source 901',
      'Group 1001: Checkout failed',
    ]) {
      expect(screen.getByRole('button', {name})).toHaveAttribute(
        'aria-expanded',
        'false'
      );
      expect(screen.queryByRole('region', {name})).not.toBeInTheDocument();
    }
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.queryByText('root-only-note')).not.toBeInTheDocument();
    expect(screen.queryByText('group-only-value')).not.toBeInTheDocument();
    expect(screen.queryByText('related-only-value')).not.toBeInTheDocument();
  });

  it('keeps root fields and action configuration open together without losing values', async () => {
    const user = userEvent.setup();
    render(<WorkflowEngineItemDetails item={detector} />);

    const root = screen.getByRole('button', {name: 'Detector 501: Checkout errors'});
    await user.click(root);
    const rootFields = screen.getByRole('region', {
      name: 'Detector 501: Checkout errors',
    });
    const properties = within(rootFields).getByRole('table', {name: 'Properties'});
    for (const name of [
      'Enabled false',
      'Status 0',
      'Description "" (empty string)',
      'Owner User ID null',
      'Future Scalar 0',
    ]) {
      expect(within(properties).getByRole('row', {name})).toBeVisible();
    }
    expect(within(rootFields).getByText('root-only-note')).toBeVisible();
    expect(await copyFieldGroup(rootFields, 'Project Options')).toEqual(
      detector.context.projectOptions
    );
    expect(await copyFieldGroup(rootFields, 'Project Option Sources')).toEqual(
      detector.context.projectOptionSources
    );
    expect(await copyFieldGroup(rootFields, 'Future Metadata')).toEqual(
      detector.context.futureMetadata
    );

    const action = screen.getByRole('button', {name: 'Action 1101'});
    await user.click(action);
    const actionFields = screen.getByRole('region', {name: 'Action 1101'});
    expect(root).toHaveAttribute('aria-expanded', 'true');
    expect(action).toHaveAttribute('aria-expanded', 'true');
    expect(await copyFieldGroup(rootFields, 'Config')).toEqual(detector.context.config);
    expect(await copyFieldGroup(actionFields, 'Config')).toEqual({
      targetIdentifier: '#checkout',
      enabled: false,
    });
    expect(
      within(rootFields).queryByRole('rowheader', {name: 'Integration ID'})
    ).not.toBeInTheDocument();
    expect(within(actionFields).queryByText('root-only-note')).not.toBeInTheDocument();
  });

  it('expands group, condition, and action fields independently and collapses only the clicked node', async () => {
    const user = userEvent.setup();
    render(<WorkflowEngineItemDetails item={detector} />);

    const group = screen.getByRole('button', {name: 'Condition Group 601'});
    await user.click(group);
    const groupFields = screen.getByRole('region', {name: 'Condition Group 601'});
    expect(within(groupFields).getByRole('row', {name: 'Logic Type all'})).toBeVisible();
    expect(
      within(groupFields).getByRole('row', {name: 'Organization ID 1'})
    ).toBeVisible();
    expect(within(groupFields).getByText('group-only-value')).toBeVisible();

    const condition = screen.getByRole('button', {name: 'Condition 701'});
    await user.click(condition);
    const conditionFields = screen.getByRole('region', {name: 'Condition 701'});
    expect(
      within(conditionFields).getByRole('row', {name: 'Comparison 0'})
    ).toBeVisible();
    expect(
      within(conditionFields).getByRole('row', {name: 'Condition Result false'})
    ).toBeVisible();
    expect(await copyFieldGroup(conditionFields, 'Future Condition Field')).toEqual({
      mode: 'condition-only-value',
      owner: null,
    });
    expect(
      within(conditionFields).queryByText('group-only-value')
    ).not.toBeInTheDocument();
    expect(
      within(groupFields).queryByRole('rowheader', {name: 'Comparison'})
    ).not.toBeInTheDocument();

    const action = screen.getByRole('button', {name: 'Action 1101'});
    await user.click(action);
    const actionFields = screen.getByRole('region', {name: 'Action 1101'});
    expect(
      within(actionFields).getByRole('row', {name: 'Integration ID 1201'})
    ).toBeVisible();
    expect(
      within(actionFields).getByRole('row', {name: 'Future Action Field null'})
    ).toBeVisible();
    expect(await copyFieldGroup(actionFields, 'Data')).toEqual({
      tags: 'environment,release',
      count: 0,
    });
    expect(within(groupFields).getByText('group-only-value')).toBeVisible();
    expect(
      within(conditionFields).getByRole('row', {name: 'Comparison 0'})
    ).toBeVisible();

    await user.click(group);
    expect(group).toHaveAttribute('aria-expanded', 'false');
    expect(
      screen.queryByRole('region', {name: 'Condition Group 601'})
    ).not.toBeInTheDocument();
    expect(condition).toHaveAttribute('aria-expanded', 'true');
    expect(action).toHaveAttribute('aria-expanded', 'true');
    expect(
      within(conditionFields).getByRole('row', {name: 'Comparison 0'})
    ).toBeVisible();
    expect(
      within(actionFields).getByRole('row', {name: 'Integration ID 1201'})
    ).toBeVisible();
  });

  it('toggles local fields with Enter and Space on the node title', async () => {
    const user = userEvent.setup();
    render(<WorkflowEngineItemDetails item={detector} />);
    const root = screen.getByRole('button', {name: 'Detector 501: Checkout errors'});

    await user.tab();
    expect(root).toHaveFocus();
    await user.keyboard('{Enter}');
    expect(root).toHaveAttribute('aria-expanded', 'true');
    expect(
      within(
        screen.getByRole('region', {name: 'Detector 501: Checkout errors'})
      ).getByText('root-only-note')
    ).toBeVisible();

    await user.keyboard(' ');
    expect(root).toHaveAttribute('aria-expanded', 'false');
    expect(
      screen.queryByRole('region', {name: 'Detector 501: Checkout errors'})
    ).not.toBeInTheDocument();

    await user.keyboard('{Enter}');
    expect(root).toHaveAttribute('aria-expanded', 'true');
    expect(
      within(
        screen.getByRole('region', {name: 'Detector 501: Checkout errors'})
      ).getByText('root-only-note')
    ).toBeVisible();
  });

  it('resets every expanded node when the item identity changes', async () => {
    const user = userEvent.setup();
    const {rerender} = render(<WorkflowEngineItemDetails item={detector} />);
    for (const name of [
      'Detector 501: Checkout errors',
      'Condition Group 601',
      'Condition 701',
      'Action 1101',
      'Workflow 801: Checkout notifications',
      'Data Source 901',
      'Group 1001: Checkout failed',
    ]) {
      await user.click(screen.getByRole('button', {name}));
      expect(screen.getByRole('region', {name})).toBeVisible();
    }

    const nextItem: DebuggerItem = {
      ...detector,
      id: '502',
      name: 'Payment errors',
      context: {...detector.context, id: '502', name: 'Payment errors'},
    };
    rerender(<WorkflowEngineItemDetails item={nextItem} />);

    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    for (const name of [
      'Detector 502: Payment errors',
      'Condition Group 601',
      'Condition 701',
      'Action 1101',
      'Workflow 801: Checkout notifications',
      'Data Source 901',
      'Group 1001: Checkout failed',
    ]) {
      expect(screen.getByRole('button', {name})).toHaveAttribute(
        'aria-expanded',
        'false'
      );
      expect(screen.queryByRole('region', {name})).not.toBeInTheDocument();
    }
    await user.click(screen.getByRole('button', {name: 'Detector 502: Payment errors'}));
    const fields = screen.getByRole('region', {
      name: 'Detector 502: Payment errors',
    });
    expect(within(fields).getByRole('row', {name: 'Name Payment errors'})).toBeVisible();
  });

  it('shows only returned fields inside each related summary', async () => {
    const user = userEvent.setup();
    render(<WorkflowEngineItemDetails item={detector} />);

    await user.click(screen.getByRole('button', {name: 'Detector 501: Checkout errors'}));
    await user.click(
      screen.getByRole('button', {name: 'Workflow 801: Checkout notifications'})
    );
    const workflowFields = screen.getByRole('region', {
      name: 'Workflow 801: Checkout notifications',
    });
    expect(within(workflowFields).getByText('related-only-value')).toBeVisible();
    expect(within(workflowFields).getByRole('row', {name: 'Enabled true'})).toBeVisible();
    expect(
      within(workflowFields).queryByRole('region', {name: 'Config'})
    ).not.toBeInTheDocument();
    expect(within(workflowFields).queryByText('root-only-note')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', {name: 'Data Source 901'}));
    const dataSourceFields = screen.getByRole('region', {name: 'Data Source 901'});
    expect(
      within(dataSourceFields).getByRole('row', {name: 'Source ID query-123'})
    ).toBeVisible();
    await user.click(screen.getByRole('button', {name: 'Group 1001: Checkout failed'}));
    const groupFields = screen.getByRole('region', {
      name: 'Group 1001: Checkout failed',
    });
    expect(within(groupFields).getByRole('row', {name: 'Priority 0'})).toBeVisible();
    expect(within(groupFields).queryByText('related-only-value')).not.toBeInTheDocument();
    expect(within(workflowFields).getByText('related-only-value')).toBeVisible();
    const rootFields = screen.getByRole('region', {
      name: 'Detector 501: Checkout errors',
    });
    expect(within(rootFields).getByText('root-only-note')).toBeVisible();
  });

  it('preserves workflow trigger and filter fields alongside their conditions and actions', async () => {
    const user = userEvent.setup();
    const workflow: DebuggerItem = {
      id: '801',
      name: 'Notify checkout',
      type: 'workflow',
      organizationId: '1',
      projectId: null,
      context: {
        config: {frequency: 0},
        triggers: {
          id: '602',
          logicType: 'any-short',
          conditions: [{id: '702', type: 'first_seen_event', comparison: true}],
          actions: [],
        },
        actionFilters: [
          {
            id: '603',
            logicType: 'all',
            conditions: [
              {id: '703', type: 'tagged_event', comparison: {value: 'production'}},
            ],
            actions: [
              {id: '1102', type: 'email', data: {recipient: 'checkout@example.com'}},
            ],
          },
        ],
        detectors: [],
      },
    };
    render(<WorkflowEngineItemDetails item={workflow} />);

    await user.click(screen.getByRole('button', {name: 'Condition Group 602'}));
    const triggerFields = screen.getByRole('region', {
      name: 'Condition Group 602',
    });
    expect(
      within(triggerFields).getByRole('row', {name: 'Logic Type any-short'})
    ).toBeVisible();
    await user.click(screen.getByRole('button', {name: 'Condition Group 603'}));
    const filterFields = screen.getByRole('region', {name: 'Condition Group 603'});
    expect(within(filterFields).getByRole('row', {name: 'Logic Type all'})).toBeVisible();
    await user.click(screen.getByRole('button', {name: 'Condition 703'}));
    const conditionFields = screen.getByRole('region', {name: 'Condition 703'});
    expect(await copyFieldGroup(conditionFields, 'Comparison')).toEqual({
      value: 'production',
    });
    await user.click(screen.getByRole('button', {name: 'Action 1102'}));
    const actionFields = screen.getByRole('region', {name: 'Action 1102'});
    expect(await copyFieldGroup(actionFields, 'Data')).toEqual({
      recipient: 'checkout@example.com',
    });
    expect(
      within(triggerFields).getByRole('row', {name: 'Logic Type any-short'})
    ).toBeVisible();
    expect(
      within(conditionFields).getByRole('region', {name: 'Comparison'})
    ).toBeVisible();
  });

  it('preserves null relationships and does not invent nodes for empty relationships', async () => {
    const user = userEvent.setup();
    const {rerender} = render(
      <WorkflowEngineItemDetails
        item={{
          ...detector,
          context: {conditionGroup: null, workflows: [], contextTruncated: true},
        }}
      />
    );

    expect(
      screen.queryByRole('button', {name: /^Condition Group/})
    ).not.toBeInTheDocument();
    expect(screen.queryByRole('button', {name: /^Workflow /})).not.toBeInTheDocument();
    expect(screen.getByText(/Context is truncated/)).toBeVisible();
    await user.click(screen.getByRole('button', {name: 'Detector 501: Checkout errors'}));
    const rootFields = screen.getByRole('region', {
      name: 'Detector 501: Checkout errors',
    });
    expect(
      within(rootFields).getByRole('row', {name: 'Condition Group null'})
    ).toBeVisible();

    rerender(
      <WorkflowEngineItemDetails
        item={{
          ...detector,
          context: {
            conditionGroup: {id: '601', logicType: 'all', conditions: [], actions: []},
            workflows: [],
          },
        }}
      />
    );
    expect(screen.queryByRole('button', {name: /^Condition \d/})).not.toBeInTheDocument();
    expect(screen.queryByRole('button', {name: /^Action /})).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', {name: 'Condition Group 601'}));
    const groupFields = screen.getByRole('region', {name: 'Condition Group 601'});
    expect(within(groupFields).getByRole('row', {name: 'Logic Type all'})).toBeVisible();
  });

  it('keeps malformed relationship values inside their source node fields', async () => {
    const user = userEvent.setup();
    const workflows = [{id: '801', name: 'Returned workflow'}, false, 0, null];
    const conditions = [{id: '701', type: 'gt', comparison: 0}, false, 0, null];
    const actions = {unexpected: 'malformed-action-collection'};
    render(
      <WorkflowEngineItemDetails
        item={{
          ...detector,
          context: {
            ...detector.context,
            workflows,
            conditionGroup: {id: '601', logicType: 'all', conditions, actions},
          },
        }}
      />
    );

    expect(
      screen.getByRole('button', {name: 'Workflow 801: Returned workflow'})
    ).toBeVisible();
    expect(screen.getByRole('button', {name: 'Condition 701'})).toBeVisible();
    expect(screen.queryByRole('button', {name: /^Action /})).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', {name: 'Detector 501: Checkout errors'}));
    const rootFields = screen.getByRole('region', {
      name: 'Detector 501: Checkout errors',
    });
    expect(await copyFieldGroup(rootFields, 'Workflows')).toEqual(workflows);
    await user.click(screen.getByRole('button', {name: 'Condition Group 601'}));
    const groupFields = screen.getByRole('region', {name: 'Condition Group 601'});
    expect(await copyFieldGroup(groupFields, 'Conditions')).toEqual(conditions);
    expect(await copyFieldGroup(groupFields, 'Actions')).toEqual(actions);
    expect(
      within(rootFields).queryByRole('region', {name: 'Actions'})
    ).not.toBeInTheDocument();
    expect(
      within(groupFields).queryByRole('region', {name: 'Workflows'})
    ).not.toBeInTheDocument();
  });
});
