import {createContext, useContext} from 'react';
import type {DistributedOmit} from 'type-fest';

import type {
  DO_NOT_USE_ButtonProps as ButtonProps,
  DO_NOT_USE_CommonButtonProps as CommonButtonProps,
} from './types';

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
export function useButtonDefaults<T extends CommonButtonProps>(props: T): T {
  return {...useContext(ButtonDefaultsContext), ...props} as T;
}
