import {createContext, useContext} from 'react';

import type {DO_NOT_USE_ButtonProps as ButtonProps} from './types';

interface ButtonDefaultProps extends Pick<ButtonProps, 'size' | 'priority'> {
  priority: NonNullable<ButtonProps['priority']>;
  size: NonNullable<ButtonProps['size']>;
}

const ButtonDefaultsContext = createContext<ButtonDefaultProps | undefined>(undefined);

interface ButtonDefaultsProviderProps extends ButtonDefaultProps {
  children: React.ReactNode;
}

/**
 * Use this context provider to set default values for icons.
 */
export function ButtonDefaultsProvider({
  children,
  ...props
}: ButtonDefaultsProviderProps) {
  return <ButtonDefaultsContext value={props}>{children}</ButtonDefaultsContext>;
}

/**
 * Provides default props for ButtonProps via
 */
export function useButtonDefaults(props: ButtonProps) {
  return {...useContext(ButtonDefaultsContext), ...props};
}
