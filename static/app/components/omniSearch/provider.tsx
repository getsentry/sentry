import {useCallback, useMemo, useState} from 'react';

import {OmniConfigContext, OmniSearchStoreContext} from './context';
import type {OmniAction, OmniArea, OmniSearchStore} from './types';

type Props = {children: React.ReactNode};

export function OmniSearchProvider({children}: Props) {
  const [isSearchingSeer, setIsSearchingSeer] = useState(false);
  const [actions, setActions] = useState<OmniAction[]>([]);
  const [areasByKey, setAreasByKey] = useState<Map<string, OmniArea>>(new Map());
  const [areaPriority, setAreaPriority] = useState<string[]>([]);

  const registerActions = useCallback((newActions: OmniAction[]) => {
    setActions(prev => {
      const result = [...prev];

      for (const newAction of newActions) {
        const existingIndex = result.findIndex(action => action.key === newAction.key);

        if (existingIndex >= 0) {
          result[existingIndex] = newAction;
        } else {
          result.push(newAction);
        }
      }

      return result;
    });
  }, []);

  const unregisterActions = useCallback((keys: string[]) => {
    setActions(prev => {
      return prev.filter(action => !keys.includes(action.key));
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
      setIsSearchingSeer,
    }),
    [
      registerActions,
      unregisterActions,
      registerAreas,
      unregisterAreas,
      registerAreaPriority,
      setIsSearchingSeer,
    ]
  );

  const store: OmniSearchStore = useMemo(
    () => ({
      actions,
      areasByKey,
      areaPriority,
      isSearchingSeer,
      setIsSearchingSeer,
    }),
    [areaPriority, actions, areasByKey, isSearchingSeer]
  );

  return (
    <OmniConfigContext.Provider value={config}>
      <OmniSearchStoreContext.Provider value={store}>
        {children}
      </OmniSearchStoreContext.Provider>
    </OmniConfigContext.Provider>
  );
}
