import {useCallback, useMemo, useState} from 'react';
import omit from 'lodash/omit';

import {OmniConfigContext, OmniSearchStoreContext} from './context';
import {
  OmniAction,
  OmniArea,
  OmniAreaMap,
  OmniSearchConfig,
  OmniSearchStore,
} from './types';

interface OmniSearchProviderProps {
  children: React.ReactNode;
}

export function OmniSearchProvider({children}: OmniSearchProviderProps) {
  const [actions, setActions] = useState<OmniAction[]>([]);
  const [areas, setAreaMap] = useState<OmniAreaMap>({});

  const registerActions = useCallback((newActions: OmniAction[]) => {
    const keys = newActions.map(a => a.key);

    setActions(currentActions => {
      return currentActions.filter(a => !keys.includes(a.key)).concat(newActions);
    });

    return () =>
      setActions(currentActions => currentActions.filter(a => !keys.includes(a.key)));
  }, []);

  const registerAreas = useCallback((newAreas: OmniArea[]) => {
    const keys = newAreas.map(a => a.key);

    setAreaMap(currentAreaMap => ({
      ...currentAreaMap,
      ...Object.fromEntries(newAreas.map(area => [area.key, area])),
    }));

    return () => setAreaMap(currentAreas => omit(currentAreas, keys));
  }, []);

  const configContext = useMemo<OmniSearchConfig>(
    () => ({
      registerActions,
      registerAreas,
    }),
    [registerActions, registerAreas]
  );

  const storeContext = useMemo<OmniSearchStore>(
    () => ({
      actions,
      areas,
    }),
    [actions, areas]
  );

  return (
    <OmniConfigContext.Provider value={configContext}>
      <OmniSearchStoreContext.Provider value={storeContext}>
        {children}
      </OmniSearchStoreContext.Provider>
    </OmniConfigContext.Provider>
  );
}
