import {useCallback, useMemo, useState} from 'react';

import {OmniConfigContext, OmniSearchStoreContext} from './context';
import {OmniAction, OmniSearchConfig, OmniSearchStore} from './types';

interface OmniSearchProviderProps {
  children: React.ReactNode;
}

export function OmniSearchProvider({children}: OmniSearchProviderProps) {
  const [actions, setActions] = useState<OmniAction[]>([]);

  const registerActions = useCallback((newActions: OmniAction[]) => {
    const keys = newActions.map(a => a.key);

    setActions(currentActions => {
      return currentActions.filter(a => !keys.includes(a.key)).concat(newActions);
    });

    return () =>
      setActions(currentActions => currentActions.filter(a => !keys.includes(a.key)));
  }, []);

  const configContext = useMemo<OmniSearchConfig>(
    () => ({
      registerActions,
    }),
    [registerActions]
  );

  const storeContext = useMemo<OmniSearchStore>(
    () => ({
      actions,
    }),
    [actions]
  );

  return (
    <OmniConfigContext.Provider value={configContext}>
      <OmniSearchStoreContext.Provider value={storeContext}>
        {children}
      </OmniSearchStoreContext.Provider>
    </OmniConfigContext.Provider>
  );
}
