import {createContext, useContext} from 'react';

interface IconProps {
  [key: string]: any;
  size?: string;
}

const IconDefaultsContext = createContext<IconProps>({});

/**
 * Use this context provider to set default values for icons.
 */
function IconDefaultsProvider({children, ...props}: IconProps) {
  return <IconDefaultsContext value={props}>{children}</IconDefaultsContext>;
}

/**
 * Provides default props for icons
 */
function useIconDefaults(props: IconProps) {
  return {...useContext(IconDefaultsContext), ...props};
}

export {IconDefaultsProvider, useIconDefaults};
