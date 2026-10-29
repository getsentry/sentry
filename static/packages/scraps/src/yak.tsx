import {
  createElement,
  type ComponentProps,
  type ComponentType,
  type ElementType,
  type FunctionComponent,
} from 'react';
import isPropValid from '@emotion/is-prop-valid';
import {useTheme} from '@emotion/react';

import type {Theme} from '@sentry/scraps/theme';

declare module '@yak/react' {
  export interface YakTheme extends Theme {}
}

/** Bridge the existing Emotion providers during this partial migration. */
export function withYakTheme<P extends {theme?: Theme}>(Component: ComponentType<P>) {
  return function YakThemeBridge(props: P) {
    const theme = useTheme();
    return createElement(Component, {...props, theme: props.theme ?? theme});
  };
}

/** Yak uses transient props; keep the public primitive APIs during the spike. */
export function withYakProps<C extends ElementType>(
  Component: C,
  shouldForwardProp: (prop: string) => boolean = typeof Component === 'string'
    ? isPropValid
    : () => true
): FunctionComponent<ComponentProps<C> & {as?: string | ElementType; theme?: Theme}> {
  return function YakElement(props) {
    const forwarded: Record<string, unknown> = {};
    for (const key in props) {
      if (key !== 'theme' && (key === 'as' || shouldForwardProp(key))) {
        forwarded[key] = props[key];
      }
    }
    if (typeof Component === 'string') {
      const {as: Tag = Component, ...domProps} = forwarded;
      return createElement(Tag as ElementType, domProps);
    }
    return createElement(Component, forwarded);
  };
}
