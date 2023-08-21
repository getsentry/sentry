import {useCallback, useMemo, useState} from 'react';

import {OmniConfigContext, OmniSearchStoreContext} from './context';
import {OmniAction, OmniSearchConfig, OmniSearchStore} from './types';

interface OmniSearchProviderProps {
  children: React.ReactNode;
}

export function OmniSearchProvider({children}: OmniSearchProviderProps) {
  const [actions, setActions] = useState<OmniAction[]>([]);

  const registerActions = useCallback(
    (newActions: OmniAction[]) =>
      setActions(currentActions => {
        const keys = newActions.map(a => a.key);
        return currentActions.filter(a => !keys.includes(a.key)).concat(newActions);
      }),
    []
  );

  const unregisterActions = useCallback((actionOrKeyList: Array<OmniAction | string>) => {
    const keys = actionOrKeyList.map(actionOrKey =>
      typeof actionOrKey === 'string' ? actionOrKey : actionOrKey.key
    );
    setActions(currentActions => currentActions.filter(a => !keys.includes(a.key)));
  }, []);

  const configContext = useMemo<OmniSearchConfig>(
    () => ({
      registerActions,
      unregisterActions,
    }),
    [registerActions, unregisterActions]
  );

  const storeContext = useMemo<OmniSearchStore>(
    () => ({
      actions,
    }),
    [actions]
  );

  console.log(storeContext);

  return (
    <OmniConfigContext.Provider value={configContext}>
      <OmniSearchStoreContext.Provider value={storeContext}>
        {children}
      </OmniSearchStoreContext.Provider>
    </OmniConfigContext.Provider>
  );
}
