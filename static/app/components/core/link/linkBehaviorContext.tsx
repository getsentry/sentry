import {createContext, useContext, type FunctionComponent} from 'react';
import {Link as RouterLink} from 'react-router-dom';
import * as Sentry from '@sentry/react';

import type {RoutedLinkProps} from './link';

type LinkBehavior = {
  behavior: (props: RoutedLinkProps) => RoutedLinkProps;
  component: FunctionComponent<RoutedLinkProps>;
};

const LinkBehaviorContext = createContext<LinkBehavior | null>(null);

const defaultLinkBehavior = {
  component: RouterLink,
  behavior: props => props,
} satisfies LinkBehavior;

export const LinkBehaviorContextProvider = LinkBehaviorContext.Provider;

export const useLinkBehavior = (props: RoutedLinkProps) => {
  const linkBehavior = useContext(LinkBehaviorContext);

  if (process.env.NODE_ENV === 'production' && !linkBehavior) {
    Sentry.logger.warn('LinkBehaviorContext not found');
  }
  const {component, behavior} = linkBehavior ?? defaultLinkBehavior;

  return {Component: component, behavior: () => behavior(props)};
};
