import {useEffect} from 'react';

import {useOmniSearchConfiguration} from './context';
import type {OmniAction} from './types';

export function useOmniActions(actions: OmniAction[] | null | undefined) {
  const {registerActions, unregisterActions} = useOmniSearchConfiguration();

  useEffect(() => {
    if (!actions || actions.length === 0) {
      return () => {};
    }
    registerActions(actions);
    return () => unregisterActions(actions.map(a => a.key));
  }, [registerActions, unregisterActions, actions]);
}
