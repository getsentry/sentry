import {act, renderHook} from 'sentry-test/reactTestingLibrary';

import {DataConditionType} from 'sentry/types/workflowEngine/dataConditions';
import {dataConditionNodesMap} from 'sentry/views/automations/components/dataConditionNodes';

import {useAutomationBuilderReducer} from './automationBuilderContext';

describe('useAutomationBuilderReducer', () => {
  it('falls back to true for when conditions without a defaultComparison', () => {
    const {result} = renderHook(useAutomationBuilderReducer);

    act(() => {
      result.current.actions.addWhenCondition(DataConditionType.FIRST_SEEN_EVENT);
    });

    const conditions = result.current.state.triggers.conditions.filter(
      c => c.type === DataConditionType.FIRST_SEEN_EVENT
    );
    const addedCondition = conditions.at(-1);

    expect(addedCondition?.comparison).toBe(true);
  });

  it('uses defaultComparison from the node map when adding a when condition', () => {
    const {result} = renderHook(useAutomationBuilderReducer);

    act(() => {
      result.current.actions.addWhenCondition(DataConditionType.SEER_ACTIVITY_TRIGGER);
    });

    const addedCondition = result.current.state.triggers.conditions.find(
      c => c.type === DataConditionType.SEER_ACTIVITY_TRIGGER
    );

    const expectedDefault = dataConditionNodesMap.get(
      DataConditionType.SEER_ACTIVITY_TRIGGER
    )?.defaultComparison;

    expect(expectedDefault).toBeDefined();
    expect(addedCondition).toBeDefined();
    expect(addedCondition?.comparison).toEqual(expectedDefault);
  });

  it('uses defaultComparison from the node map when adding an if condition', () => {
    const {result} = renderHook(useAutomationBuilderReducer);
    const groupId = result.current.state.actionFilters[0]!.id;

    act(() => {
      result.current.actions.addIfCondition(groupId, DataConditionType.AGE_COMPARISON);
    });

    const addedCondition = result.current.state.actionFilters[0]?.conditions.find(
      c => c.type === DataConditionType.AGE_COMPARISON
    );

    const expectedDefault = dataConditionNodesMap.get(
      DataConditionType.AGE_COMPARISON
    )?.defaultComparison;

    expect(expectedDefault).toBeDefined();
    expect(addedCondition).toBeDefined();
    expect(addedCondition?.comparison).toEqual(expectedDefault);
  });
});
