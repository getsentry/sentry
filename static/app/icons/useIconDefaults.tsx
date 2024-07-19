import {createContext, useContext} from 'react';

import type {SVGIconProps} from './svgIcon';

const IconDefaultsContext = createContext<SVGIconProps>({});

/**
 * Use this context provider to set default values for icons.
 */
function IconDefaultsProvider({children, ...props}: SVGIconProps) {
  return (
    <IconDefaultsContext.Provider value={props}>{children}</IconDefaultsContext.Provider>
  );
}

/**
 * Provides default props for SVGIconProps via
 */
function useIconDefaults(props: SVGIconProps) {
  return {...useContext(IconDefaultsContext), ...props};
}

export {IconDefaultsProvider, useIconDefaults};
