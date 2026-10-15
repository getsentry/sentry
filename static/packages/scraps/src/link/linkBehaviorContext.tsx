import type * as React from 'react';
import {createContext, useContext, type FunctionComponent} from 'react';
import * as queryString from 'query-string';

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
  if (typeof to === 'string') {
    return <a {...props} href={to} />;
  }

  const {pathname = '', hash = '', search = '', query} = to;
  const querySearch = query ? queryString.stringify(query) : search;
  const href = `${pathname}${
    querySearch && !querySearch.startsWith('?') ? '?' : ''
  }${querySearch}${hash && !hash.startsWith('#') ? '#' : ''}${hash}`;
  return <a {...props} href={href} />;
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
