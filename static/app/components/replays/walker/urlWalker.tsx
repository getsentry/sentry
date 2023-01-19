import {memo} from 'react';

import ChevronDividedList from 'sentry/components/replays/walker/chevronDividedList';
import splitCrumbs, {SummarySegment} from 'sentry/components/replays/walker/splitCrumbs';
import {
  BreadcrumbLevelType,
  BreadcrumbType,
  BreadcrumbTypeNavigation,
  Crumb,
} from 'sentry/types/breadcrumbs';
import useCrumbHandlers from 'sentry/utils/replays/hooks/useCrumbHandlers';
import type {ReplayRecord} from 'sentry/views/replays/types';

type CrumbProps = {
  crumbs: Crumb[];
  replayRecord: ReplayRecord;
};

type StringProps = {
  urls: string[];
};

export const CrumbWalker = memo(function CrumbWalker({crumbs, replayRecord}: CrumbProps) {
  const startTimestampMs = replayRecord.started_at.getTime();
  const {handleClick} = useCrumbHandlers(startTimestampMs);

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

export const StringWalkerSummary = memo(function StringSummary({urls}: StringProps) {
  return (
    <SummarySegment
      crumbs={urls.map(urlToCrumb) as Crumb[]}
      handleOnClick={null}
      startTimestampMs={0}
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
