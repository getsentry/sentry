import {createContext, useContext, type FunctionComponent} from 'react';
import {Link as RouterLink} from 'react-router-dom';
import * as Sentry from '@sentry/react';
import type {LocationDescriptor} from 'history';

import type {LinkProps} from './link';

/**
 * LinkProps with `to` guaranteed. The Link component resolves `href`/`to`
 * before delegating to the context, so the behavior always receives a
 * concrete destination.
 */
export type ResolvedLinkProps = LinkProps & {to: LocationDescriptor};

type LinkBehavior = {
  behavior: (props: ResolvedLinkProps) => ResolvedLinkProps;
  component: FunctionComponent<ResolvedLinkProps>;
};

const LinkBehaviorContext = createContext<LinkBehavior | null>(null);

const defaultLinkBehavior = {
  component: RouterLink,
  behavior: props => props,
} satisfies LinkBehavior;

export const LinkBehaviorContextProvider = LinkBehaviorContext.Provider;

export const useLinkBehavior = (props: ResolvedLinkProps) => {
  const linkBehavior = useContext(LinkBehaviorContext);

  if (process.env.NODE_ENV === 'production' && !linkBehavior) {
    Sentry.logger.warn('LinkBehaviorContext not found');
  }
  const {component, behavior} = linkBehavior ?? defaultLinkBehavior;

  return {Component: component, behavior: () => behavior(props)};
};
