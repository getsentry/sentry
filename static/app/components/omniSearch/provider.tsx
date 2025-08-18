import {useCallback, useMemo, useRef, useState} from 'react';

import {OmniConfigContext, OmniSearchStoreContext} from './context';
import type {OmniAction, OmniArea, OmniSearchStore} from './types';

type Props = {children: React.ReactNode};

export function OmniSearchProvider({children}: Props) {
  const actionsByKeyRef = useRef<Map<string, OmniAction>>(new Map());
  const areasByKeyRef = useRef<Map<string, OmniArea>>(new Map());
  const [areaPriority, setAreaPriority] = useState<string[]>([]);

  const registerActions = useCallback((actions: OmniAction[]) => {
    const map = actionsByKeyRef.current;
    for (const action of actions) {
      map.set(action.key, action);
    }
  }, []);

  const unregisterActions = useCallback((keys: string[]) => {
    const map = actionsByKeyRef.current;
    for (const key of keys) {
      map.delete(key);
    }
  }, []);

  const registerAreas = useCallback((areas: OmniArea[]) => {
    const map = areasByKeyRef.current;
    for (const area of areas) {
      map.set(area.key, area);
    }
  }, []);

  const unregisterAreas = useCallback((keys: string[]) => {
    const map = areasByKeyRef.current;
    for (const key of keys) {
      map.delete(key);
    }
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
      actionsByKey: actionsByKeyRef.current,
      areasByKey: areasByKeyRef.current,
      areaPriority,
    }),
    [areaPriority]
  );

  return (
    <OmniConfigContext.Provider value={config}>
      <OmniSearchStoreContext.Provider value={store}>
        {children}
      </OmniSearchStoreContext.Provider>
    </OmniConfigContext.Provider>
  );
}
