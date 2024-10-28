import {useEffect, useMemo} from 'react';
import intersection from 'lodash/intersection';
import moment from 'moment-timezone';

import type {Event} from 'sentry/types/event';
import type {Organization} from 'sentry/types/organization';
import {trackAnalytics} from 'sentry/utils/analytics';
import {useApiQuery, type UseApiQueryResult} from 'sentry/utils/queryClient';
import type RequestError from 'sentry/utils/requestError/requestError';
import {
  hydrateToFlagSeries,
  type RawFlagData,
} from 'sentry/views/issueDetails/streamline/featureFlagUtils';

export default function useSuspectFlags({
  organization,
  query,
  firstSeen,
  rawFlagData,
  event,
}: {
  event: Event | undefined;
  firstSeen: string;
  organization: Organization;
  query: Record<string, any>;
  rawFlagData: RawFlagData | undefined;
}): UseApiQueryResult<RawFlagData, RequestError> {
  const hydratedFlagData = hydrateToFlagSeries(rawFlagData);

  // map flag data to arrays of flag names
  const auditLogFlagNames = hydratedFlagData.map(f => f.name);
  const evaluatedFlagNames = event?.contexts.flags?.values.map(f => f.flag);
  const intersectionFlags = useMemo(
    () => intersection(auditLogFlagNames, evaluatedFlagNames),
    [auditLogFlagNames, evaluatedFlagNames]
  );

  // no flags in common between event evaluations and audit log
  useEffect(() => {
    if (!intersectionFlags.length) {
      trackAnalytics('flags.event_and_suspect_flags_found', {
        numTotalFlags: hydratedFlagData.length,
        numEventFlags: 0,
        numSuspectFlags: 0,
        organization,
      });
    }
  }, [hydratedFlagData.length, intersectionFlags.length, organization]);

  // get all the audit log flag changes which happened prior to the first seen date
  const start = moment(firstSeen).subtract(1, 'year').format('YYYY-MM-DD HH:mm:ss');
  const apiQueryResponse = useApiQuery<RawFlagData>(
    [
      `/organizations/${organization.slug}/flags/logs/`,
      {
        query: {
          ...query,
          flag: intersectionFlags,
          start,
          end: firstSeen,
          statsPeriod: undefined,
        },
      },
    ],
    {
      staleTime: 0,
      // if no intersection, then there are no suspect flags
      enabled: Boolean(
        organization.features?.includes('feature-flag-ui') && intersectionFlags.length
      ),
    }
  );

  const {data, isError, isPending} = apiQueryResponse;

  // remove duplicate flags - keeps the one closest to the firstSeen date
  // TODO: cap the number of suspect flags to 3
  const suspectFlags = useMemo(() => {
    return data
      ? data.data
          .reverse()
          .filter(
            (rawFlag, idx, rawFlagArray) =>
              idx === rawFlagArray.findIndex(f => f.flag === rawFlag.flag)
          )
      : [];
  }, [data]);

  // track the funnel from
  // all audit log flags -> event level flags -> suspect flags
  useEffect(() => {
    if (intersectionFlags.length && !isError && !isPending) {
      trackAnalytics('flags.event_and_suspect_flags_found', {
        numTotalFlags: hydratedFlagData.length,
        numEventFlags: intersectionFlags.length,
        numSuspectFlags: suspectFlags.length,
        organization,
      });
    }
  }, [
    hydratedFlagData,
    isError,
    isPending,
    suspectFlags,
    intersectionFlags,
    organization,
  ]);

  return apiQueryResponse;
}
