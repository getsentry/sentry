import {useEffect} from 'react';

import {useOmniSearchConfiguration} from './context';
import {OmniArea} from './types';

/**
 * Register areas of an omni search.
 *
 * Each regsitered area will appear as a heading within the omni-search modal.
 */
export function useOmniActions(areas: OmniArea[]) {
  const {registerAreas} = useOmniSearchConfiguration();

  useEffect(() => registerAreas(areas));
}
