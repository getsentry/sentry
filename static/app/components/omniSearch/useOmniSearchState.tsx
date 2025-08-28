import {useMemo, useState} from 'react';
import sortBy from 'lodash/sortBy';

import {useOmniSearchStore} from './context';
import type {OmniAction, OmniArea} from './types';

export function useOmniSearchState() {
  const {actions, areaPriority, areasByKey} = useOmniSearchStore();

  const [focusedArea, setFocusedArea] = useState<OmniArea | null>(() => {
    return (
      areaPriority.map(areaKey => areasByKey.get(areaKey)).find(a => a?.focused) ?? null
    );
  });
  const [selectedAction, setSelectedAction] = useState<OmniAction | null>(null);

  const areasByPriority = useMemo(
    () =>
      sortBy(Array.from(areasByKey.values()), area =>
        areaPriority.reverse().indexOf(area.key)
      ),
    [areasByKey, areaPriority]
  );

  const displayedActions = useMemo(() => {
    if (selectedAction?.children?.length) {
      return selectedAction.children?.filter(action => !action.hidden);
    }

    const globalActions = actions.filter(action => action.areaKey === 'global');

    if (focusedArea) {
      const areaActions = actions.filter(
        action => action.areaKey === focusedArea.key && !action.hidden
      );

      return [...areaActions, ...globalActions];
    }

    return globalActions;
  }, [selectedAction, focusedArea, actions]);

  return {
    actions: displayedActions,
    areas: areasByPriority,
    areaPriority,
    focusedArea,
    selectedAction,
    selectAction: setSelectedAction,
    clearSelection: () => {
      setSelectedAction(null);
      setFocusedArea(null);
    },
  };
}
