import {createContext, useContext} from 'react';

import type {SVGIconProps} from './svgIcon';

const IconDefaultsContext = createContext<SVGIconProps>({});

/**
 * Use this context provider to set default values for icons.
 */
export function IconDefaultsProvider({children, ...props}: SVGIconProps) {
  return <IconDefaultsContext value={props}>{children}</IconDefaultsContext>;
}

/**
 * Provides default props for SVGIconProps via
 */
export function useIconDefaults(props: SVGIconProps) {
  return {...useContext(IconDefaultsContext), ...props};
}
