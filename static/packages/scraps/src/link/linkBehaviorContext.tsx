import type * as React from 'react';
import {createContext, useCallback, useContext, type FunctionComponent} from 'react';

import type {LinkProps} from './link';

type QueryString = {
  parse: (search: string) => Record<string, string | string[] | null>;
  stringify: (query: Record<string, unknown>) => string;
};

type LinkBehavior<T extends LinkProps> = {
  behavior: (props: T) => T;
  component: FunctionComponent<T>;
  /** Query string helpers default to URLSearchParams behavior. */
  parse?: QueryString['parse'];
  stringify?: QueryString['stringify'];
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
  const {stringify} = useLinkQueryString();
  return <a {...props} href={destinationToHref(to, stringify)} />;
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

function parseQuery(search: string): ReturnType<QueryString['parse']> {
  const query: Record<string, string | string[]> = Object.create(null);
  for (const [key, value] of new URLSearchParams(search)) {
    const existing = query[key];
    if (existing === undefined) {
      query[key] = value;
    } else {
      query[key] = [...(Array.isArray(existing) ? existing : [existing]), value];
    }
  }
  return query;
}

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

/** Use the provider's query helpers, or the native defaults outside a provider. */
export function useLinkQueryString(): QueryString {
  const linkBehavior = useContext(LinkBehaviorContext);
  return {
    parse: linkBehavior?.parse ?? parseQuery,
    stringify: linkBehavior?.stringify ?? stringifyQuery,
  };
}

function destinationToHref(
  to: LinkProps['to'],
  stringify: QueryString['stringify']
): string {
  if (typeof to === 'string') {
    return to;
  }
  const {pathname = '', hash = '', search = '', query} = to;
  const querySearch = query ? stringify(query) : search;
  return `${pathname}${querySearch && !querySearch.startsWith('?') ? '?' : ''}${querySearch}${hash && !hash.startsWith('#') ? '#' : ''}${hash}`;
}

/** Resolve collection hrefs through the same application behavior as Link. */
export function useResolveLinkHref() {
  const linkBehavior = useContext(LinkBehaviorContext);
  const {stringify} = useLinkQueryString();
  return useCallback(
    (to: LinkProps['to']) =>
      destinationToHref(linkBehavior ? linkBehavior.behavior({to}).to : to, stringify),
    [linkBehavior, stringify]
  );
}
