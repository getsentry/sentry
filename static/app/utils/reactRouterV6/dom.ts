import {createElement, type ComponentProps} from 'react';
import {RouterProvider as RouterProviderV6} from 'react-router-dom';

type RouterProviderProps = ComponentProps<typeof RouterProviderV6> & {
  useTransitions?: boolean;
};

export function RouterProvider({
  useTransitions: _useTransitions,
  ...props
}: RouterProviderProps) {
  return createElement(RouterProviderV6, props);
}
