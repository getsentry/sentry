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
  const [areaPriority, setAreaPriority] = useState<string[]>([]);

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

  const registerAreaPriority = useCallback((newPriority: string[]) => {
    setAreaPriority(newPriority);

    return () => setAreaPriority(newPriority.slice(0, -1));
  }, []);

  const configContext = useMemo<OmniSearchConfig>(
    () => ({
      registerActions,
      registerAreas,
      registerAreaPriority,
    }),
    [registerActions, registerAreas, registerAreaPriority]
  );

  const storeContext = useMemo<OmniSearchStore>(
    () => ({
      actions,
      areas,
      areaPriority,
    }),
    [actions, areas, areaPriority]
  );

  return (
    <OmniConfigContext.Provider value={configContext}>
      <OmniSearchStoreContext.Provider value={storeContext}>
        {children}
      </OmniSearchStoreContext.Provider>
    </OmniConfigContext.Provider>
  );
}
