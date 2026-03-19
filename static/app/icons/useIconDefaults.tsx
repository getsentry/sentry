import {createContext, useContext} from 'react';

import {useSizeContext} from '@sentry/scraps/sizeContext';

import type {IconSize} from 'sentry/utils/theme';

import type {SVGIconProps} from './svgIcon';

const IconDefaultsContext = createContext<SVGIconProps>({});

/**
 * Use this context provider to set default values for icons.
 * @deprecated Use SizeProvider from sizeContext instead.
 */
export function IconDefaultsProvider({children, ...props}: SVGIconProps) {
  return <IconDefaultsContext value={props}>{children}</IconDefaultsContext>;
}

const ICON_SIZE_FROM_CONTEXT: Record<string, IconSize | undefined> = {
  zero: undefined,
  xs: 'xs',
  sm: 'sm',
  md: 'md',
  lg: 'lg',
  xl: 'xl',
  '2xl': '2xl',
};

/**
 * Provides default props for SVGIconProps, falling back to SizeContext
 * if no explicit size is provided via IconDefaultsProvider.
 */
export function useIconDefaults(props: SVGIconProps) {
  const contextDefaults = useContext(IconDefaultsContext);
  const sizeContext = useSizeContext();
  const sizeFromContext =
    sizeContext === undefined ? undefined : ICON_SIZE_FROM_CONTEXT[sizeContext];
  return {
    size: sizeFromContext,
    ...contextDefaults,
    ...props,
  };
}
