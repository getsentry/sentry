import {useContext} from 'react';

import {useOmniSearchStore} from './context';

export function useOmniSearchState() {
  const {actions, areaPriority, areas} = useOmniSearchStore();

  const focusedArea = areaPriority
    .map(areaKey => areas.find(a => a.key === areaKey))
    .find(area => area?.focused);

  return {
    actions,
    areas,
    areaPriority,
    focusedArea,
  };
}
