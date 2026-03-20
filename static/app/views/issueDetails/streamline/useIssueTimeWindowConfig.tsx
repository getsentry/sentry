import {useMemo, useState} from 'react';
import moment from 'moment-timezone';

import {usePageFilterDates as useCronsPageFilterDates} from 'sentry/components/checkInTimeline/hooks/useMonitorDates';
import {getConfigFromTimeRange} from 'sentry/components/checkInTimeline/utils/getConfigFromTimeRange';
import {useTimezone} from 'sentry/components/timezoneProvider';
import type {Group} from 'sentry/types/group';
import {intervalToMilliseconds} from 'sentry/utils/duration/intervalToMilliseconds';
import {useLocation} from 'sentry/utils/useLocation';
import {useGroupDefaultStatsPeriod} from 'sentry/views/issueDetails/useGroupDefaultStatsPeriod';

export function useIssueTimeWindowConfig({
  timelineWidth,
  group,
}: {
  group: Group;
  timelineWidth: number;
}) {
  const [now] = useState<Date>(() =>
    moment().startOf('minute').add(1, 'minutes').toDate()
  );
  const location = useLocation();
  const {since: pageFilterSince, until: pageFilterUntil} = useCronsPageFilterDates();
  const defaultStatsPeriod = useGroupDefaultStatsPeriod(group, group.project);
  const timezone = useTimezone();

  const hasSetStatsPeriod =
    location.query.statsPeriod || location.query.start || location.query.end;

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
    () => getConfigFromTimeRange(since, until, timelineWidth, timezone),
    [since, until, timelineWidth, timezone]
  );
}
