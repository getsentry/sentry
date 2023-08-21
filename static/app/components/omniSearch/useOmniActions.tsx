import {useEffect} from 'react';

import {useOmniSearchConfiguration} from './context';
import {OmniAction} from './types';

/**
 * Register contextual actions into the omni-search interface
 */
export function useOmniActions(actions: OmniAction[]) {
  const {registerActions} = useOmniSearchConfiguration();

  useEffect(() => registerActions(actions));
}
