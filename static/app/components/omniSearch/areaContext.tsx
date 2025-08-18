import {createContext, useContext, useEffect, useMemo} from 'react';

import {useOmniSearchConfiguration} from './context';
import type {OmniArea} from './types';

const AreaContext = createContext<string[]>([]);

interface OmniSearchAreaProps extends Omit<OmniArea, 'key'> {
  areaKey: string;
  children: React.ReactNode;
}

export function OmniSearchArea({areaKey, label, focused, children}: OmniSearchAreaProps) {
  const {registerAreas, unregisterAreas, registerAreaPriority} =
    useOmniSearchConfiguration();

  // Register/unregister this area
  useEffect(() => {
    registerAreas([{key: areaKey, label, focused}]);
    return () => unregisterAreas([areaKey]);
  }, [registerAreas, unregisterAreas, areaKey, label, focused]);

  const stack = useContext(AreaContext);
  const nestedStack = useMemo(() => [...stack, areaKey], [stack, areaKey]);

  useEffect(() => registerAreaPriority(nestedStack), [registerAreaPriority, nestedStack]);

  return <AreaContext.Provider value={nestedStack}>{children}</AreaContext.Provider>;
}
