import sortBy from 'lodash/sortBy';

import {useOmniSearchStore} from './context';

export function useOmniSearchState() {
  const {actionsByKey, areaPriority, areasByKey} = useOmniSearchStore();

  const focusedArea = areaPriority
    .map(areaKey => areasByKey.get(areaKey))
    .find(area => area?.focused);

  const areasByPriority = sortBy(Array.from(areasByKey.values()), area =>
    areaPriority.reverse().indexOf(area.key)
  );

  const displayedActions = focusedArea
    ? sortBy(
        Array.from(actionsByKey.values()).filter(
          action => action.areaKey === focusedArea.key
        ),
        action => action.label
      )
    : sortBy(Array.from(actionsByKey.values()), action => action.label);

  return {
    actions: displayedActions,
    areas: areasByPriority,
    areaPriority,
    focusedArea,
  };
}
