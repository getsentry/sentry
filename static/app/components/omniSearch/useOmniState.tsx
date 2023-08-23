import sortBy from 'lodash/sortBy';

import {useOmniSearchStore} from './context';

export function useOmniSearchState() {
  const {actions, areaPriority, areas} = useOmniSearchStore();

  const focusedArea = areaPriority
    .map(areaKey => areas.find(a => a.key === areaKey))
    .find(area => area?.focused);

  const areasByPriority = sortBy(areas, area => areaPriority.reverse().indexOf(area.key));

  return {
    actions,
    areas: areasByPriority,
    areaPriority,
    focusedArea,
  };
}
