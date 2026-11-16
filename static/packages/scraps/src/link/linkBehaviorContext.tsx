import type * as React from 'react';
import {createContext, useCallback, useContext, type FunctionComponent} from 'react';

import type {LinkProps} from './link';

type LinkBehavior<T extends LinkProps> = {
  behavior: (props: T) => T;
  component: FunctionComponent<T>;
  /**
   * Resolve the original destination, including application normalization, to an href.
   * Defaults to applying `behavior` and serializing with URLSearchParams.
   */
  resolveHref?: (to: T['to']) => string;
};

const LinkBehaviorContext = createContext<LinkBehavior<LinkProps> | null>(null);

function AnchorLink({
  to,
  replace: _replace,
  preventScrollReset: _preventScrollReset,
  reloadDocument: _reloadDocument,
  state: _state,
  ...props
}: LinkProps) {
  return <a {...props} href={destinationToHref(to)} />;
}

const defaultLinkBehavior = <T extends LinkProps>() =>
  ({
    component: AnchorLink,
    behavior: props => props,
  }) satisfies LinkBehavior<T>;

export const LinkBehaviorContextProvider = LinkBehaviorContext.Provider;

export const useLinkBehavior = <T extends LinkProps>(props: T) => {
  const linkBehavior = useContext<LinkBehavior<T> | null>(
    LinkBehaviorContext as React.Context<LinkBehavior<T> | null>
  );

  const {component, behavior} = linkBehavior ?? defaultLinkBehavior<T>();

  return {Component: component, behavior: () => behavior(props)};
};

function stringifyQuery(query: Record<string, unknown>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    for (const item of Array.isArray(value) ? value : [value]) {
      if (item !== undefined) {
        params.append(key, String(item));
      }
    }
  }
  return params.toString();
}

function destinationToHref(to: LinkProps['to']): string {
  if (typeof to === 'string') {
    return to;
  }
  const {pathname = '', hash = '', search = '', query} = to;
  const querySearch = query ? stringifyQuery(query) : search;
  return `${pathname}${querySearch && !querySearch.startsWith('?') ? '?' : ''}${querySearch}${hash && !hash.startsWith('#') ? '#' : ''}${hash}`;
}

/** Resolve collection hrefs through the same application behavior as Link. */
export function useResolveLinkHref() {
  const linkBehavior = useContext(LinkBehaviorContext);
  return useCallback(
    (to: LinkProps['to']) => {
      if (linkBehavior?.resolveHref) {
        return linkBehavior.resolveHref(to);
      }
      return destinationToHref(linkBehavior ? linkBehavior.behavior({to}).to : to);
    },
    [linkBehavior]
  );
}
