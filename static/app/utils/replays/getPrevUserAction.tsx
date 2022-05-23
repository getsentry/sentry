import {relativeTimeInMs} from 'sentry/components/replays/utils';
import {Crumb} from 'sentry/types/breadcrumbs';

export function getPrevUserAction(
  userActionCrumbs: Crumb[],
  startTimestamp: number | undefined,
  currentHoverTime: number
) {
  if (!startTimestamp || userActionCrumbs.length < 1) {
    return undefined;
  }

  const prevUserAction = userActionCrumbs.reduce((prev, curr) => {
    return curr &&
      currentHoverTime > relativeTimeInMs(curr.timestamp ?? '', startTimestamp)
      ? curr
      : prev;
  });

  return currentHoverTime >=
    relativeTimeInMs(prevUserAction.timestamp ?? '', startTimestamp)
    ? prevUserAction
    : undefined;
}
