import {useMemo, useState} from 'react';
import sortBy from 'lodash/sortBy';

import {useOmniSearchStore} from './context';
import type {OmniAction} from './types';

export function useOmniSearchState() {
  const {actionsByKey, areaPriority, areasByKey} = useOmniSearchStore();

  const [selectedAction, setSelectedAction] = useState<OmniAction | null>(null);

  const focusedArea = useMemo(
    () =>
      areaPriority.map(areaKey => areasByKey.get(areaKey)).find(area => area?.focused) ??
      null,
    [areaPriority, areasByKey]
  );

  const areasByPriority = useMemo(
    () =>
      sortBy(Array.from(areasByKey.values()), area =>
        areaPriority.reverse().indexOf(area.key)
      ),
    [areasByKey, areaPriority]
  );

  const displayedActions = useMemo(() => {
    if (selectedAction?.children?.length) {
      return selectedAction.children;
    }

    if (focusedArea) {
      const areaActions = sortBy(
        Array.from(actionsByKey.values()).filter(
          action => action.areaKey === focusedArea.key
        ),
        action => action.label
      );

      const otherActions = sortBy(
        Array.from(actionsByKey.values()).filter(action => action.areaKey === 'global'),
        action => action.label
      );

      return [...areaActions, ...otherActions];
    }

    return sortBy(Array.from(actionsByKey.values()), action => action.label);
  }, [selectedAction, focusedArea, actionsByKey]);

  return {
    actions: displayedActions,
    areas: areasByPriority,
    areaPriority,
    focusedArea,
    selectedAction,
    selectAction: setSelectedAction,
    clearSelection: () => {
      if (selectedAction) {
        setSelectedAction(null);
      }
    },
  };
}
