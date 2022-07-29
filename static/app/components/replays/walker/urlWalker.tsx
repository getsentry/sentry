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
import type {ReplayRecord} from 'sentry/views/replays/types';

type CrumbProps = {
  crumbs: Crumb[];
  replayRecord: ReplayRecord;
};

type StringProps = {
  urls: string[];
};

export const CrumbWalker = memo(function CrumbWalker({crumbs, replayRecord}: CrumbProps) {
  const {setCurrentTime} = useReplayContext();

  const startTimestampMs = replayRecord.started_at.getTime();

  const handleClick = useCallback(
    (crumb: Crumb) => {
      crumb.timestamp !== undefined
        ? setCurrentTime(relativeTimeInMs(crumb.timestamp, startTimestampMs))
        : null;
    },
    [setCurrentTime, startTimestampMs]
  );

  const navCrumbs = crumbs.filter(
    crumb => crumb.type === BreadcrumbType.NAVIGATION
  ) as BreadcrumbTypeNavigation[];

  return (
    <ChevronDividedList
      items={splitCrumbs({
        crumbs: navCrumbs,
        startTimestampMs,
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
        startTimestampMs: 0,
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
