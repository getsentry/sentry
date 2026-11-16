import type * as React from 'react';
import {createContext, useCallback, useContext, type FunctionComponent} from 'react';

import type {LinkProps} from './link';

type LinkBehavior<T extends LinkProps> = {
  behavior: (props: T) => T;
  component: FunctionComponent<T>;
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

function encodeQueryComponent(value: unknown): string {
  return encodeURIComponent(String(value)).replace(
    /[!'()*]/g,
    char => `%${char.charCodeAt(0).toString(16).toUpperCase()}`
  );
}

/**
 * Follows the app's `sentry/utils/url/qs`, which this package cannot import:
 * sorted keys, repeated keys for arrays, a bare key for `null`, and no key for
 * `undefined`.
 */
function stringifyQuery(query: Record<string, unknown>): string {
  return Object.keys(query)
    .sort()
    .flatMap(key => {
      const value = query[key];
      return (Array.isArray(value) ? value : [value])
        .filter(item => item !== undefined)
        .map(item =>
          item === null
            ? encodeQueryComponent(key)
            : `${encodeQueryComponent(key)}=${encodeQueryComponent(item)}`
        );
    })
    .join('&');
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
    (to: LinkProps['to']) =>
      destinationToHref(linkBehavior ? linkBehavior.behavior({to}).to : to),
    [linkBehavior]
  );
}
