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

interface UseConnectedIdsProps {
  storageKey: string;
  initialIds?: string[];
}

export function useConnectedIds({storageKey, initialIds = []}: UseConnectedIdsProps) {
  const [connectedIds, setConnectedIds] = useState<Set<string>>(() => {
    if (initialIds.length > 0) {
      localStorage.setItem(storageKey, JSON.stringify(initialIds));
      return new Set(initialIds);
    }
    const stored = localStorage.getItem(storageKey);
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
      localStorage.setItem(storageKey, JSON.stringify(Array.from(newSet)));
      return newSet;
    });
  };

  return {connectedIds, toggleConnected};
}

export const NEW_AUTOMATION_CONNECTED_IDS_KEY = 'new-automation-connected-ids';
