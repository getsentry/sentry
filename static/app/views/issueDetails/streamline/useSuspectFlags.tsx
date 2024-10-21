import moment from 'moment-timezone';

import type {Event} from 'sentry/types/event';
import type {Organization} from 'sentry/types/organization';
import {trackAnalytics} from 'sentry/utils/analytics';
import {useApiQuery} from 'sentry/utils/queryClient';

type RawFlag = {
  action: string;
  created_at: string;
  created_by: string;
  created_by_type: string;
  flag: string;
  id: number;
  tags: Record<string, any>;
};

export type RawFlagData = {data: RawFlag[]};

export type FlagSeriesDatapoint = {
  // flag action
  label: {formatter: () => string};
  // flag name
  name: string;
  // unix timestamp
  xAxis: number;
};

export function hydrateFlagData({
  rawFlagData,
}: {
  rawFlagData: RawFlagData | undefined;
}): FlagSeriesDatapoint[] {
  if (!rawFlagData) {
    return [];
  }

  // transform raw flag data into series data
  // each data point needs to be type FlagSeriesDatapoint
  const flagData = rawFlagData.data.map(f => {
    return {
      xAxis: Date.parse(f.created_at),
      label: {formatter: () => f.action},
      name: `${f.flag}`,
    };
  });
  return flagData;
}

export default function useSuspectFlags({
  organization,
  query,
  firstSeen,
  rawFlagData,
  event,
}: {
  event: Event;
  firstSeen: string;
  organization: Organization;
  query: Record<string, any>;
  rawFlagData: RawFlagData | undefined;
}) {
  const hydratedFlagData: FlagSeriesDatapoint[] = hydrateFlagData({rawFlagData});

  // map flag data to arrays of flag names
  const auditLogFlagNames = hydratedFlagData.map(f => {
    return f.name;
  });
  const evaluatedFlagNames = event.contexts.flags?.values.map(f => {
    return f.flag;
  });
  const intersection = auditLogFlagNames.filter(f => evaluatedFlagNames?.includes(f));

  // no flags in common between event evaluations and audit log
  if (!intersection.length) {
    trackAnalytics('flags.event_and_suspect_flags_found', {
      numEventFlags: 0,
      numSuspectFlags: 0,
      organization,
    });
  }

  // get all the audit log flag changes which happened prior to the first seen date
  const start = moment(firstSeen).subtract(1, 'year').format('YYYY-MM-DD HH:mm:ss');
  const {data, isError, isPending} = useApiQuery<RawFlagData>(
    [
      `/organizations/${organization.slug}/flags/logs/`,
      {
        query: {
          ...query,
          flag: intersection,
          start,
          end: firstSeen,
          statsPeriod: undefined,
        },
      },
    ],
    {
      staleTime: 0,
      enabled: organization.features?.includes('feature-flag-ui'),
    }
  );

  // track the funnel from
  // all audit log flags -> event level flags -> suspect flags
  if (intersection.length && data && !isError && !isPending) {
    trackAnalytics('flags.event_and_suspect_flags_found', {
      numEventFlags: intersection.length,
      numSuspectFlags: data.data.length,
      organization,
    });
  }

  // if no intersection, then there are no suspect flags
  return {data: intersection.length ? data : [], isError, isPending};
}
