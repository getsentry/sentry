import {unstable_usePrompt, type Location} from 'react-router';

type LegacyRouteLeaveCallback = (state: {
  currentLocation: Location;
  nextLocation: Location;
}) => boolean;

interface LegacyOnRouteLeaveProps {
  message: string;
  when: LegacyRouteLeaveCallback;
}

export function LegacyOnRouteLeave(props: LegacyOnRouteLeaveProps) {
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
