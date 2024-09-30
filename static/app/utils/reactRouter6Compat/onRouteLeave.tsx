import {type Location, unstable_usePrompt} from 'react-router-dom';

import type {InjectedRouter, PlainRoute} from 'sentry/types/legacyReactRouter';

type ReactRouterV6RouteLeaveCallback = (state: {
  currentLocation: Location;
  nextLocation: Location;
}) => boolean;
type ReactRouterV3RouteLeaveCallback = () => string | undefined;

interface OnRouteLeaveProps {
  legacyWhen: ReactRouterV3RouteLeaveCallback;
  message: string;
  route: PlainRoute;
  router: InjectedRouter<any, any>;
  when: ReactRouterV6RouteLeaveCallback;
}

export function OnRouteLeave(props: OnRouteLeaveProps) {
  unstable_usePrompt({
    message: props.message,
    when: state =>
      props.when({
        currentLocation: state.currentLocation,
        nextLocation: state.nextLocation,
      }),
  });

  return null;
}
