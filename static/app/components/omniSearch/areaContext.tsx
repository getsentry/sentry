import {createContext, useContext, useEffect, useMemo} from 'react';

import {useOmniSearchConfiguration} from './context';
import {OmniArea} from './types';
import {useOmniAreas} from './useOmniAreas';

const AreaContext = createContext<string[]>([]);

interface OmniSearchAreaProps extends Omit<OmniArea, 'key'> {
  /**
   * The key used for the area
   */
  areaKey: string;
  /**
   * Additional `OmniSearchArea`s may be nested within the children to create a
   * deeper area priority stack.
   */
  children: React.ReactNode;
}

/**
 * Registers an area within the omni-search.
 *
 * This maintains the stack for areaPriority by considering the context stack
 * of OmniSearchArea components within the tree.
 *
 * If you do not need contextual priority prefer the `useOmniAreas` hook to
 * configure areas within the omni-search.
 */
export function OmniSearchArea({areaKey, label, focused, children}: OmniSearchAreaProps) {
  useOmniAreas([{key: areaKey, label, focused}]);

  // Construct the stack
  const stack = useContext(AreaContext);
  const nestedStack = useMemo(() => [...stack, areaKey], [stack, areaKey]);

  // Register the current stack as the global area priority
  const {registerAreaPriority} = useOmniSearchConfiguration();
  useEffect(() => registerAreaPriority(nestedStack), [registerAreaPriority, nestedStack]);

  return <AreaContext.Provider value={nestedStack}>{children}</AreaContext.Provider>;
}
