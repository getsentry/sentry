import {createContext, useContext, type FunctionComponent} from 'react';

import type {LinkProps} from './link';

const LinkBehaviorContext = createContext<{
  behavior: (props: LinkProps) => LinkProps;
  component: FunctionComponent<LinkProps> | 'a';
}>({
  component: 'a',
  behavior: props => props,
});

export const LinkBehaviorContextProvider = LinkBehaviorContext.Provider;

export const useLinkBehavior = (props: LinkProps) => {
  const {component, behavior} = useContext(LinkBehaviorContext);

  return {Component: component, behavior: () => behavior(props)};
};
