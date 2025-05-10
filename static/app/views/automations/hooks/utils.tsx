import {useState} from 'react';

import type {ActionType} from 'sentry/types/workflowEngine/actions';
import type {Automation} from 'sentry/types/workflowEngine/automations';

export function useAutomationActions(automation: Automation): ActionType[] {
  return [
    ...new Set(
      automation.actionFilters
        .flatMap(dataConditionGroup =>
          dataConditionGroup.actions?.map(action => action.type)
        )
        .filter(x => x)
    ),
  ] as ActionType[];
}

export function useConnectedIds() {
  const [connectedIds, setConnectedIds] = useState<Set<string>>(() => {
    const stored = localStorage.getItem('connectedIds');
    return stored ? new Set(JSON.parse(stored)) : new Set();
  });

  const toggleConnected = (id: string) => {
    setConnectedIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      localStorage.setItem('connectedIds', JSON.stringify(Array.from(newSet)));
      return newSet;
    });
  };

  return {connectedIds, toggleConnected};
}
