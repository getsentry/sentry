import {memo, useCallback} from 'react';

import {useReplayContext} from 'sentry/components/replays/replayContext';
import {relativeTimeInMs} from 'sentry/components/replays/utils';
import ChevronDividedList from 'sentry/components/replays/walker/chevronDividedList';
import splitCrumbs from 'sentry/components/replays/walker/splitCrumbs';
import {
  BreadcrumbLevelType,
  BreadcrumbType,
  BreadcrumbTypeNavigation,
  Crumb,
} from 'sentry/types/breadcrumbs';
import type {EventTransaction} from 'sentry/types/event';

type CrumbProps = {
  crumbs: Crumb[];
  event: EventTransaction;
};

type StringProps = {
  urls: string[];
};

export const CrumbWalker = memo(function CrumbWalker({crumbs, event}: CrumbProps) {
  const {setCurrentTime} = useReplayContext();

  const startTimestamp = event.startTimestamp;

  const handleClick = useCallback(
    (crumb: Crumb) => {
      crumb.timestamp !== undefined
        ? setCurrentTime(relativeTimeInMs(crumb.timestamp, startTimestamp))
        : null;
    },
    [setCurrentTime, startTimestamp]
  );

  const navCrumbs = crumbs.filter(
    crumb => crumb.type === BreadcrumbType.NAVIGATION
  ) as BreadcrumbTypeNavigation[];

  return (
    <ChevronDividedList
      items={splitCrumbs({
        crumbs: navCrumbs,
        startTimestamp,
        onClick: handleClick,
      })}
    />
  );
});

export const StringWalker = memo(function StringWalker({urls}: StringProps) {
  return (
    <ChevronDividedList
      items={splitCrumbs({
        crumbs: urls.map(urlToCrumb),
        startTimestamp: 0,
        onClick: null,
      })}
    />
  );
});

function urlToCrumb(url: string) {
  return {
    type: BreadcrumbType.NAVIGATION,
    category: BreadcrumbType.NAVIGATION,
    level: BreadcrumbLevelType.INFO,
    description: 'Navigation',

    id: 0,
    color: 'green300',
    timestamp: undefined,
    data: {to: url},
  } as BreadcrumbTypeNavigation;
}
