import {useEffect} from 'react';

import {useOmniSearchConfiguration} from './context';
import type {OmniArea} from './types';

export function useOmniAreas(areas: OmniArea[] | null | undefined) {
  const {registerAreas, unregisterAreas} = useOmniSearchConfiguration();

  useEffect(() => {
    if (!areas || areas.length === 0) {
      return () => {};
    }
    registerAreas(areas);
    return () => {
      unregisterAreas(areas.map(a => a.key));
    };
  }, [registerAreas, unregisterAreas, areas]);
}
