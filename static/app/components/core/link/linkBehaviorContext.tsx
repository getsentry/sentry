import {createContext, useContext, type FunctionComponent} from 'react';
import {Link as RouterLink} from 'react-router-dom';
import * as Sentry from '@sentry/react';

import type {LinkProps} from './link';

type LinkBehavior = {
  behavior: (props: LinkProps) => LinkProps;
  component: FunctionComponent<LinkProps>;
};

const LinkBehaviorContext = createContext<LinkBehavior | null>(null);

const defaultLinkBehavior = {
  component: RouterLink,
  behavior: props => props,
} satisfies LinkBehavior;

export const LinkBehaviorContextProvider = LinkBehaviorContext.Provider;

export const useLinkBehavior = (props: LinkProps) => {
  const linkBehavior = useContext(LinkBehaviorContext);

  if (process.env.NODE_ENV === 'production' && !linkBehavior) {
    Sentry.logger.warn('LinkBehaviorContext not found');
  }
  const {component, behavior} = linkBehavior ?? defaultLinkBehavior;

  return {Component: component, behavior: () => behavior(props)};
};
