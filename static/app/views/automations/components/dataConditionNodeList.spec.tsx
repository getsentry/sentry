import {DataConditionFixture} from 'sentry-fixture/automations';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {DataConditionHandlerFixture} from 'sentry-fixture/workflowEngine';

import {render, screen, userEvent, within} from 'sentry-test/reactTestingLibrary';

import type {DataConditionHandler} from 'sentry/types/workflowEngine/dataConditions';
import {
  DataConditionHandlerGroupType,
  DataConditionHandlerSubgroupType,
  DataConditionType,
} from 'sentry/types/workflowEngine/dataConditions';
import {MatchType} from 'sentry/views/automations/components/actionFilters/constants';
import {AutomationBuilderConflictContext} from 'sentry/views/automations/components/automationBuilderConflictContext';
import {AutomationBuilderErrorContext} from 'sentry/views/automations/components/automationBuilderErrorContext';
import DataConditionNodeList from 'sentry/views/automations/components/dataConditionNodeList';

const dataConditionHandlers: DataConditionHandler[] = [
  DataConditionHandlerFixture({type: DataConditionType.AGE_COMPARISON}),
  DataConditionHandlerFixture({
    type: DataConditionType.ISSUE_PRIORITY_GREATER_OR_EQUAL,
  }),
  DataConditionHandlerFixture({
    type: DataConditionType.ISSUE_PRIORITY_DEESCALATING,
  }),
  DataConditionHandlerFixture({
    type: DataConditionType.EVENT_FREQUENCY,
    handlerSubgroup: DataConditionHandlerSubgroupType.EVENT_ATTRIBUTES,
  }),
];

describe('DataConditionNodeList', function () {
  const organization = OrganizationFixture({features: ['workflow-engine-ui']});

  const mockOnAddRow = jest.fn();
  const mockOnDeleteRow = jest.fn();
  const mockUpdateCondition = jest.fn();

  const groupId = '0';
  const defaultProps = {
    conditions: [],
    conflictingConditionIds: new Set<string>(),
    conflictReason: null,
    groupId,
    handlerGroup: DataConditionHandlerGroupType.ACTION_FILTER,
    onAddRow: mockOnAddRow,
    onDeleteRow: mockOnDeleteRow,
    placeholder: 'Any event',
    updateCondition: mockUpdateCondition,
  };
  const defaultConflictContextProps = {
    conflictingConditionGroups: {},
    conflictReason: null,
  };
  const defaultErrorContextProps = {
    errors: {},
    setErrors: jest.fn(),
    removeError: jest.fn(),
  };

  beforeEach(function () {
    MockApiClient.clearMockResponses();
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/data-conditions/`,
      body: dataConditionHandlers,
    });
  });

  it('renders correct condition options', async function () {
    render(
      <AutomationBuilderErrorContext.Provider value={defaultErrorContextProps}>
        <AutomationBuilderConflictContext.Provider value={defaultConflictContextProps}>
          <DataConditionNodeList {...defaultProps} />
        </AutomationBuilderConflictContext.Provider>
        ,
      </AutomationBuilderErrorContext.Provider>,
      {
        organization,
      }
    );
    await userEvent.click(screen.getByRole('textbox', {name: 'Add condition'}));

    // Deescalating condition should not be shown in the dropdown
    expect(screen.getAllByRole('menuitemradio')).toHaveLength(3);
    expect(screen.getByRole('menuitemradio', {name: 'Issue age'})).toBeInTheDocument();
    expect(
      screen.getByRole('menuitemradio', {name: 'Issue priority'})
    ).toBeInTheDocument();
    expect(
      screen.getByRole('menuitemradio', {name: 'Number of events'})
    ).toBeInTheDocument();
  });

  it('adds conditions', async function () {
    render(
      <AutomationBuilderErrorContext.Provider value={defaultErrorContextProps}>
        <AutomationBuilderConflictContext.Provider value={defaultConflictContextProps}>
          <DataConditionNodeList {...defaultProps} />
        </AutomationBuilderConflictContext.Provider>
      </AutomationBuilderErrorContext.Provider>,
      {
        organization,
      }
    );

    await userEvent.click(screen.getByRole('textbox', {name: 'Add condition'}));
    await userEvent.click(screen.getByRole('menuitemradio', {name: 'Issue age'}));

    expect(mockOnAddRow).toHaveBeenCalledWith(DataConditionType.AGE_COMPARISON);
  });

  it('updates existing conditions', async function () {
    render(
      <AutomationBuilderErrorContext.Provider value={defaultErrorContextProps}>
        <AutomationBuilderConflictContext.Provider value={defaultConflictContextProps}>
          <DataConditionNodeList
            {...defaultProps}
            conditions={[DataConditionFixture()]}
          />
        </AutomationBuilderConflictContext.Provider>
      </AutomationBuilderErrorContext.Provider>,
      {organization}
    );

    await userEvent.type(screen.getByRole('textbox', {name: 'Tag'}), 's');
    expect(mockUpdateCondition).toHaveBeenCalledWith('1', {
      comparison: {key: 'names', match: MatchType.CONTAINS, value: 'moo deng'},
    });
  });

  it('deletes existing condition', async function () {
    render(
      <AutomationBuilderErrorContext.Provider value={defaultErrorContextProps}>
        <AutomationBuilderConflictContext.Provider value={defaultConflictContextProps}>
          <DataConditionNodeList
            {...defaultProps}
            conditions={[DataConditionFixture()]}
          />
        </AutomationBuilderConflictContext.Provider>
      </AutomationBuilderErrorContext.Provider>,
      {organization}
    );

    await userEvent.click(screen.getByRole('button', {name: 'Delete row'}));
    expect(mockOnDeleteRow).toHaveBeenCalledWith('1');
  });

  it('handles adding issue priority deescalating condition', async function () {
    render(
      <AutomationBuilderErrorContext.Provider value={defaultErrorContextProps}>
        <AutomationBuilderConflictContext.Provider value={defaultConflictContextProps}>
          <DataConditionNodeList
            {...defaultProps}
            conditions={[
              DataConditionFixture({
                type: DataConditionType.ISSUE_PRIORITY_GREATER_OR_EQUAL,
              }),
            ]}
          />
        </AutomationBuilderConflictContext.Provider>
      </AutomationBuilderErrorContext.Provider>,
      {
        organization,
      }
    );

    await userEvent.click(screen.getByRole('checkbox', {name: 'Notify on deescalation'}));
    expect(mockOnAddRow).toHaveBeenCalledWith(
      DataConditionType.ISSUE_PRIORITY_DEESCALATING
    );
  });

  it('handles deleting issue priority deescalating condition', async function () {
    render(
      <AutomationBuilderErrorContext.Provider value={defaultErrorContextProps}>
        <AutomationBuilderConflictContext.Provider value={defaultConflictContextProps}>
          <DataConditionNodeList
            {...defaultProps}
            conditions={[
              DataConditionFixture({
                id: 'issue-priority',
                type: DataConditionType.ISSUE_PRIORITY_GREATER_OR_EQUAL,
              }),
              DataConditionFixture({
                id: 'deescalating',
                type: DataConditionType.ISSUE_PRIORITY_DEESCALATING,
              }),
            ]}
          />
        </AutomationBuilderConflictContext.Provider>
      </AutomationBuilderErrorContext.Provider>,
      {
        organization,
      }
    );

    await userEvent.click(screen.getByRole('checkbox', {name: 'Notify on deescalation'}));
    expect(mockOnDeleteRow).toHaveBeenCalledWith('deescalating');
    mockOnDeleteRow.mockClear();

    // Deleting the issue priority condition should also delete the deescalating condition
    await userEvent.click(screen.getByRole('button', {name: 'Delete row'}));
    expect(mockOnDeleteRow).toHaveBeenCalledTimes(2);
    expect(mockOnDeleteRow).toHaveBeenCalledWith('issue-priority');
    expect(mockOnDeleteRow).toHaveBeenCalledWith('deescalating');
  });

  it('shows conflicting condition warning for action filters', function () {
    const conflictReason = 'The conditions highlighted in red are in conflict.';
    render(
      <AutomationBuilderErrorContext.Provider value={defaultErrorContextProps}>
        <AutomationBuilderConflictContext.Provider
          value={{
            conflictingConditionGroups: {[groupId]: new Set(['1'])},
            conflictReason,
          }}
        >
          <DataConditionNodeList {...defaultProps} />
        </AutomationBuilderConflictContext.Provider>
      </AutomationBuilderErrorContext.Provider>,
      {
        organization,
      }
    );

    expect(screen.getByText(conflictReason)).toBeInTheDocument();
  });

  it('only shows conflicting condition warning for two or more workflow triggers', function () {
    const conflictReason = 'The conditions highlighted in red are in conflict.';
    // Only one conflicting condition should not show the warning
    render(
      <AutomationBuilderErrorContext.Provider value={defaultErrorContextProps}>
        <AutomationBuilderConflictContext.Provider
          value={{
            conflictingConditionGroups: {[groupId]: new Set(['1'])},
            conflictReason,
          }}
        >
          <DataConditionNodeList
            {...defaultProps}
            handlerGroup={DataConditionHandlerGroupType.WORKFLOW_TRIGGER}
          />
        </AutomationBuilderConflictContext.Provider>
      </AutomationBuilderErrorContext.Provider>,
      {organization}
    );

    expect(screen.queryByText(conflictReason)).not.toBeInTheDocument();

    // Two or more conflicting conditions should show the warning
    render(
      <AutomationBuilderErrorContext.Provider value={defaultErrorContextProps}>
        <AutomationBuilderConflictContext.Provider
          value={{
            conflictingConditionGroups: {[groupId]: new Set(['1', '2'])},
            conflictReason,
          }}
        >
          <DataConditionNodeList
            {...defaultProps}
            handlerGroup={DataConditionHandlerGroupType.WORKFLOW_TRIGGER}
          />
        </AutomationBuilderConflictContext.Provider>
      </AutomationBuilderErrorContext.Provider>,
      {organization}
    );

    expect(screen.getByText(conflictReason)).toBeInTheDocument();
  });

  it('displays error message when error context contains an error for a condition', function () {
    const conditionWithError = DataConditionFixture({
      id: 'condition-with-error',
    });
    const errorMessage = 'This condition has an error';

    render(
      <AutomationBuilderErrorContext.Provider
        value={{
          ...defaultErrorContextProps,
          errors: {'condition-with-error': errorMessage},
        }}
      >
        <AutomationBuilderConflictContext.Provider value={defaultConflictContextProps}>
          <DataConditionNodeList {...defaultProps} conditions={[conditionWithError]} />
        </AutomationBuilderConflictContext.Provider>
      </AutomationBuilderErrorContext.Provider>,
      {organization}
    );

    expect(screen.getByText(errorMessage)).toBeInTheDocument();
  });

  it('shows warning message for occurrence-based monitors', async function () {
    render(
      <AutomationBuilderErrorContext.Provider
        value={{errors: {}, setErrors: jest.fn(), removeError: jest.fn()}}
      >
        <AutomationBuilderConflictContext.Provider value={defaultConflictContextProps}>
          <DataConditionNodeList {...defaultProps} />
        </AutomationBuilderConflictContext.Provider>
      </AutomationBuilderErrorContext.Provider>,
      {organization}
    );

    // Open dropdown
    await userEvent.click(screen.getByRole('textbox', {name: 'Add condition'}));
    // Find the "Number of events" option which should have a warning icon
    const numberOfEventsOption = screen.getByRole('menuitemradio', {
      name: 'Number of events',
    });
    // Hover over the warning icon within the "Number of events" option
    const warningIcon = within(numberOfEventsOption).getByRole('img');
    await userEvent.hover(warningIcon);

    expect(
      await screen.findByText(
        'These filters will only apply to some of your monitors and triggers.'
      )
    ).toBeInTheDocument();
  });
});
