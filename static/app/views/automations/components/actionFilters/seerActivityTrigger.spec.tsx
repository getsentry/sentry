import {DataConditionFixture} from 'sentry-fixture/automations';

import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {DataConditionType} from 'sentry/types/workflowEngine/dataConditions';
import {
  SeerActivityTriggerDetails,
  SeerActivityTriggerNode,
  validateSeerActivityTriggerCondition,
} from 'sentry/views/automations/components/actionFilters/seerActivityTrigger';
import {AutomationBuilderErrorContext} from 'sentry/views/automations/components/automationBuilderErrorContext';
import {DataConditionNodeContext} from 'sentry/views/automations/components/dataConditionNodes';

describe('SeerActivityTriggerDetails', () => {
  it('renders single-stage text', () => {
    render(
      <SeerActivityTriggerDetails
        condition={DataConditionFixture({
          type: DataConditionType.SEER_ACTIVITY_TRIGGER,
          comparison: ['pr_ready_for_review'],
        })}
      />
    );

    expect(
      screen.getByText("Seer reaches the 'Pull request ready for review' stage")
    ).toBeInTheDocument();
  });

  it('renders multi-stage text', () => {
    render(
      <SeerActivityTriggerDetails
        condition={DataConditionFixture({
          type: DataConditionType.SEER_ACTIVITY_TRIGGER,
          comparison: ['rca_completed', 'coding_completed'],
        })}
      />
    );

    expect(
      screen.getByText(
        'Seer reaches any of these stages: Root cause analysis completed, Coding completed'
      )
    ).toBeInTheDocument();
  });

  it('handles empty comparison gracefully', () => {
    render(
      <SeerActivityTriggerDetails
        condition={DataConditionFixture({
          type: DataConditionType.SEER_ACTIVITY_TRIGGER,
          comparison: [],
        })}
      />
    );

    expect(screen.getByText('Seer reaches any of these stages:')).toBeInTheDocument();
  });

  it('filters out a legacy pr_created stage', () => {
    // A legacy `pr_created` value is no longer a known stage (the draft/ready split
    // replaced it) and is filtered out of the details render until the user re-selects.
    render(
      <SeerActivityTriggerDetails
        condition={DataConditionFixture({
          type: DataConditionType.SEER_ACTIVITY_TRIGGER,
          comparison: ['pr_created', 'rca_completed'],
        })}
      />
    );

    expect(
      screen.getByText("Seer reaches the 'Root cause analysis completed' stage")
    ).toBeInTheDocument();
  });
});

describe('SeerActivityTriggerNode', () => {
  const dataCondition = DataConditionFixture({
    id: 'seer-1',
    type: DataConditionType.SEER_ACTIVITY_TRIGGER,
    comparison: ['rca_completed', 'coding_completed'],
  });
  const errorContext = {
    errors: {},
    mutationErrors: undefined,
    setErrors: jest.fn(),
    removeError: jest.fn(),
  };
  const dataConditionNodeContext = {
    condition: dataCondition,
    condition_id: dataCondition.id,
    onUpdate: jest.fn(),
  };

  it('renders the label and select', () => {
    render(
      <AutomationBuilderErrorContext.Provider value={errorContext}>
        <DataConditionNodeContext.Provider value={dataConditionNodeContext}>
          <SeerActivityTriggerNode />
        </DataConditionNodeContext.Provider>
      </AutomationBuilderErrorContext.Provider>
    );

    expect(
      screen.getByText('Seer runs on an issue and reaches the stage...')
    ).toBeInTheDocument();
    expect(
      screen.getByRole('textbox', {name: 'Seer activity stages'})
    ).toBeInTheDocument();
  });

  it('calls onUpdate and removeError when a stage is selected', async () => {
    render(
      <AutomationBuilderErrorContext.Provider value={errorContext}>
        <DataConditionNodeContext.Provider value={dataConditionNodeContext}>
          <SeerActivityTriggerNode />
        </DataConditionNodeContext.Provider>
      </AutomationBuilderErrorContext.Provider>
    );
    await userEvent.click(screen.getByRole('textbox', {name: 'Seer activity stages'}));
    await userEvent.click(
      screen.getByRole('menuitemcheckbox', {name: 'Pull request ready for review'})
    );
    await waitFor(() => {
      expect(dataConditionNodeContext.onUpdate).toHaveBeenCalledWith({
        comparison: dataCondition.comparison.concat('pr_ready_for_review'),
      });
    });
    expect(errorContext.removeError).toHaveBeenCalledWith('seer-1');
  });

  it('renders pre-selected stages', () => {
    render(
      <AutomationBuilderErrorContext.Provider value={errorContext}>
        <DataConditionNodeContext.Provider value={dataConditionNodeContext}>
          <SeerActivityTriggerNode />
        </DataConditionNodeContext.Provider>
      </AutomationBuilderErrorContext.Provider>
    );

    expect(screen.getByText('Root cause analysis completed')).toBeInTheDocument();
    expect(screen.getByText('Coding completed')).toBeInTheDocument();
  });

  it('filters a legacy pr_created value out of the select', () => {
    render(
      <AutomationBuilderErrorContext.Provider value={errorContext}>
        <DataConditionNodeContext.Provider
          value={{
            ...dataConditionNodeContext,
            condition: DataConditionFixture({
              id: 'seer-1',
              type: DataConditionType.SEER_ACTIVITY_TRIGGER,
              comparison: ['pr_created'],
            }),
          }}
        >
          <SeerActivityTriggerNode />
        </DataConditionNodeContext.Provider>
      </AutomationBuilderErrorContext.Provider>
    );

    // A retired `pr_created` value is not a known stage, so the select shows nothing
    // selected until the user picks the replacement option.
    expect(screen.queryByText('Pull request ready for review')).not.toBeInTheDocument();
  });
});

describe('validateSeerActivityTriggerCondition', () => {
  it('returns error when comparison is invalid', () => {
    expect(
      validateSeerActivityTriggerCondition({
        condition: DataConditionFixture({
          type: DataConditionType.SEER_ACTIVITY_TRIGGER,
          comparison: [],
        }),
      })
    ).toBe('You must select at least one Seer stage.');

    expect(
      validateSeerActivityTriggerCondition({
        condition: DataConditionFixture({
          type: DataConditionType.SEER_ACTIVITY_TRIGGER,
          comparison: undefined,
        }),
      })
    ).toBe('You must select at least one Seer stage.');
  });

  it('returns undefined for valid comparison', () => {
    expect(
      validateSeerActivityTriggerCondition({
        condition: DataConditionFixture({
          type: DataConditionType.SEER_ACTIVITY_TRIGGER,
          comparison: ['rca_completed'],
        }),
      })
    ).toBeUndefined();
  });

  it('errors for a legacy pr_created-only comparison', () => {
    // A legacy `pr_created` value is not a known stage, so it alone doesn't pass
    // validation; the user must select the replacement option to save.
    expect(
      validateSeerActivityTriggerCondition({
        condition: DataConditionFixture({
          type: DataConditionType.SEER_ACTIVITY_TRIGGER,
          comparison: ['pr_created'],
        }),
      })
    ).toBe('You must select at least one Seer stage.');
  });
});
