import {type Location, unstable_usePrompt} from 'react-router-dom';

type ReactRouterV6RouteLeaveCallback = (state: {
  currentLocation: Location;
  nextLocation: Location;
}) => boolean;

interface OnRouteLeaveProps {
  message: string;
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
