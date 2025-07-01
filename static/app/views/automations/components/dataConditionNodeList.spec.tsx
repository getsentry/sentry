import {DataConditionFixture} from 'sentry-fixture/automations';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {DataConditionHandlerFixture} from 'sentry-fixture/workflowEngine';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import type {DataConditionHandler} from 'sentry/types/workflowEngine/dataConditions';
import {
  DataConditionHandlerGroupType,
  DataConditionHandlerSubgroupType,
  DataConditionType,
} from 'sentry/types/workflowEngine/dataConditions';
import {MatchType} from 'sentry/views/automations/components/actionFilters/constants';
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
    type: DataConditionType.TAGGED_EVENT,
    handlerSubgroup: DataConditionHandlerSubgroupType.EVENT_ATTRIBUTES,
  }),
];

describe('DataConditionNodeList', function () {
  const organization = OrganizationFixture({features: ['workflow-engine-ui']});

  const mockOnAddRow = jest.fn();
  const mockOnDeleteRow = jest.fn();
  const mockUpdateCondition = jest.fn();

  const defaultProps = {
    conditions: [],
    conflictingConditionIds: [],
    group: '0',
    handlerGroup: DataConditionHandlerGroupType.ACTION_FILTER,
    onAddRow: mockOnAddRow,
    onDeleteRow: mockOnDeleteRow,
    placeholder: 'Any event',
    updateCondition: mockUpdateCondition,
  };

  beforeEach(function () {
    MockApiClient.clearMockResponses();
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/data-conditions/`,
      body: dataConditionHandlers,
    });
  });

  it('renders correct condition options', async function () {
    render(<DataConditionNodeList {...defaultProps} />, {
      organization,
    });
    await userEvent.click(screen.getByRole('textbox', {name: 'Add condition'}));

    // Deescalating condition should not be shown in the dropdown
    expect(screen.getAllByRole('menuitemradio')).toHaveLength(3);
    expect(screen.getByRole('menuitemradio', {name: 'Issue age'})).toBeInTheDocument();
    expect(
      screen.getByRole('menuitemradio', {name: 'Issue priority'})
    ).toBeInTheDocument();
    expect(screen.getByRole('menuitemradio', {name: 'Tagged event'})).toBeInTheDocument();
  });

  it('adds conditions', async function () {
    render(<DataConditionNodeList {...defaultProps} />, {
      organization,
    });

    await userEvent.click(screen.getByRole('textbox', {name: 'Add condition'}));
    await userEvent.click(screen.getByRole('menuitemradio', {name: 'Issue age'}));

    expect(mockOnAddRow).toHaveBeenCalledWith(DataConditionType.AGE_COMPARISON);
  });

  it('updates existing conditions', async function () {
    render(
      <DataConditionNodeList {...defaultProps} conditions={[DataConditionFixture()]} />,
      {organization}
    );

    await userEvent.type(screen.getByRole('textbox', {name: 'Tag'}), 's');
    expect(mockUpdateCondition).toHaveBeenCalledWith('1', {
      comparison: {key: 'names', match: MatchType.CONTAINS, value: 'moo deng'},
    });
  });

  it('deletes existing condition', async function () {
    render(
      <DataConditionNodeList {...defaultProps} conditions={[DataConditionFixture()]} />,
      {organization}
    );

    await userEvent.click(screen.getByRole('button', {name: 'Delete row'}));
    expect(mockOnDeleteRow).toHaveBeenCalledWith('1');
  });

  it('handles adding issue priority deescalating condition', async function () {
    render(
      <DataConditionNodeList
        {...defaultProps}
        conditions={[
          DataConditionFixture({type: DataConditionType.ISSUE_PRIORITY_GREATER_OR_EQUAL}),
        ]}
      />,
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
      />,
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
    render(<DataConditionNodeList {...defaultProps} conflictingConditionIds={['1']} />, {
      organization,
    });

    expect(
      screen.getByText(
        'The conditions highlighted in red are in conflict. They may prevent the alert from ever being triggered.'
      )
    ).toBeInTheDocument();
  });

  it('only shows conflicting condition warning for two or more workflow triggers', function () {
    // Only one conflicting condition should not show the warning
    render(
      <DataConditionNodeList
        {...defaultProps}
        conflictingConditionIds={['1']}
        handlerGroup={DataConditionHandlerGroupType.WORKFLOW_TRIGGER}
      />,
      {organization}
    );

    expect(
      screen.queryByText(
        'The conditions highlighted in red are in conflict.  They may prevent the alert from ever being triggered.'
      )
    ).not.toBeInTheDocument();

    // Two or more conflicting conditions should show the warning
    render(
      <DataConditionNodeList
        {...defaultProps}
        conflictingConditionIds={['1', '2']}
        handlerGroup={DataConditionHandlerGroupType.WORKFLOW_TRIGGER}
      />,
      {organization}
    );

    expect(
      screen.getByText(
        'The conditions highlighted in red are in conflict. They may prevent the alert from ever being triggered.'
      )
    ).toBeInTheDocument();
  });
});
