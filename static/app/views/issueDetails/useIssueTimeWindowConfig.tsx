import {useMemo, useState} from 'react';
import moment from 'moment-timezone';

import {useTimezone} from '@sentry/scraps/datetime';

import {usePageFilterDates as useCronsPageFilterDates} from 'sentry/components/checkInTimeline/hooks/useMonitorDates';
import {getConfigFromTimeRange} from 'sentry/components/checkInTimeline/utils/getConfigFromTimeRange';
import type {Group} from 'sentry/types/group';
import {intervalToMilliseconds} from 'sentry/utils/duration/intervalToMilliseconds';
import {pageFilterParsers} from 'sentry/utils/url/pageFilterParsers';
import {useLocation} from 'sentry/utils/useLocation';
import {loadQueryParamsFromLocation} from 'sentry/views/explore/queryParams/parsers';

import {useGroupDefaultStatsPeriod} from './useGroupDefaultStatsPeriod';

export function useIssueTimeWindowConfig({
  timelineWidth,
  group,
  maxBucketInterval,
}: {
  group: Group;
  timelineWidth: number;
  maxBucketInterval?: number;
}) {
  const [now] = useState<Date>(() =>
    moment().startOf('minute').add(1, 'minutes').toDate()
  );
  const location = useLocation();
  const {since: pageFilterSince, until: pageFilterUntil} = useCronsPageFilterDates();
  const defaultStatsPeriod = useGroupDefaultStatsPeriod(group, group.project);
  const timezone = useTimezone();

  const {statsPeriod, start, end} = loadQueryParamsFromLocation(
    pageFilterParsers,
    location
  );
  const hasSetStatsPeriod = statsPeriod || start || end;

  let since: Date;
  let until: Date;
  if (hasSetStatsPeriod) {
    since = pageFilterSince;
    until = pageFilterUntil;
  } else {
    // Assume default stats period is being used
    const periodMs = intervalToMilliseconds(defaultStatsPeriod?.statsPeriod ?? '24h');
    until = now;
    since = moment(now).subtract(periodMs, 'milliseconds').toDate();
  }

  return useMemo(
    () =>
      getConfigFromTimeRange(since, until, timelineWidth, timezone, maxBucketInterval),
    [since, until, timelineWidth, timezone, maxBucketInterval]
  );
}
