import {useCallback, useMemo, useState} from 'react';

import {OmniConfigContext, OmniSearchStoreContext} from './context';
import type {OmniAction, OmniArea, OmniSearchStore} from './types';

type Props = {children: React.ReactNode};

export function OmniSearchProvider({children}: Props) {
  const [actionsByKey, setActionsByKey] = useState<Map<string, OmniAction>>(new Map());
  const [areasByKey, setAreasByKey] = useState<Map<string, OmniArea>>(new Map());
  const [areaPriority, setAreaPriority] = useState<string[]>([]);

  const registerActions = useCallback((actions: OmniAction[]) => {
    setActionsByKey(prev => {
      const map = new Map(prev);
      for (const action of actions) {
        map.set(action.key, action);
      }
      return map;
    });
  }, []);

  const unregisterActions = useCallback((keys: string[]) => {
    setActionsByKey(prev => {
      const map = new Map(prev);
      for (const key of keys) {
        map.delete(key);
      }
      return map;
    });
  }, []);

  const registerAreas = useCallback((areas: OmniArea[]) => {
    setAreasByKey(prev => {
      const map = new Map(prev);
      for (const area of areas) {
        map.set(area.key, area);
      }
      return map;
    });
  }, []);

  const unregisterAreas = useCallback((keys: string[]) => {
    setAreasByKey(prev => {
      const map = new Map(prev);
      for (const key of keys) {
        map.delete(key);
      }
      return map;
    });
  }, []);

  const registerAreaPriority = useCallback((priority: string[]) => {
    setAreaPriority(priority);
  }, []);

  const config = useMemo(
    () => ({
      registerActions,
      unregisterActions,
      registerAreas,
      unregisterAreas,
      registerAreaPriority,
    }),
    [
      registerActions,
      unregisterActions,
      registerAreas,
      unregisterAreas,
      registerAreaPriority,
    ]
  );

  const store: OmniSearchStore = useMemo(
    () => ({
      actionsByKey,
      areasByKey,
      areaPriority,
    }),
    [areaPriority, actionsByKey, areasByKey]
  );

  return (
    <OmniConfigContext.Provider value={config}>
      <OmniSearchStoreContext.Provider value={store}>
        {children}
      </OmniSearchStoreContext.Provider>
    </OmniConfigContext.Provider>
  );
}
