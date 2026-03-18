import {createContext, useContext} from 'react';
import type {DistributedOmit} from 'type-fest';

import type {DO_NOT_USE_ButtonProps as ButtonProps} from './types';

const ButtonDefaultsContext = createContext<
  DistributedOmit<ButtonProps, 'children'> | undefined
>(undefined);

/**
 * Use this context provider to set default values for icons.
 */
export function ButtonDefaultsProvider(props: ButtonProps & {children: React.ReactNode}) {
  const {children, ...rest} = props;
  return <ButtonDefaultsContext value={rest}>{children}</ButtonDefaultsContext>;
}

/**
 * Provides default props for ButtonProps via
 */
export function useButtonDefaults(props: ButtonProps) {
  return {...useContext(ButtonDefaultsContext), ...props};
}
