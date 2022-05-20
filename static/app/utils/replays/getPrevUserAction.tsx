import {relativeTimeInMs} from 'sentry/components/replays/utils';
import {Crumb} from 'sentry/types/breadcrumbs';

export function getPrevUserAction(
  userActionCrumbs: Crumb[] | undefined,
  startTimestamp: number | undefined,
  currentHoverTime: number | undefined
) {
  if (
    !startTimestamp ||
    !userActionCrumbs ||
    userActionCrumbs.length < 1 ||
    currentHoverTime === undefined
  ) {
    return undefined;
  }

  const prevUserAction = userActionCrumbs.reduce((prev, curr) => {
    return curr &&
      currentHoverTime >= relativeTimeInMs(curr.timestamp ?? '', startTimestamp)
      ? curr
      : prev;
  });

  return currentHoverTime >=
    relativeTimeInMs(prevUserAction.timestamp ?? '', startTimestamp)
    ? prevUserAction
    : undefined;
}
