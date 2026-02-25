import {useMemo} from 'react';

import getApiUrl from 'sentry/utils/api/getApiUrl';
import {getUtcDateString} from 'sentry/utils/dates';
import {useApiQuery} from 'sentry/utils/queryClient';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import useOrganization from 'sentry/utils/useOrganization';
import type {AttributeBreakdownsComparison} from 'sentry/views/explore/hooks/useAttributeBreakdownComparison';
import {SAMPLING_MODE} from 'sentry/views/explore/hooks/useProgressiveQuery';

const BASELINE_DAYS = 7;

interface UseDetectorAttributeComparisonParams {
  aggregate: string;
  isOpenPeriodLoading: boolean;
  openPeriodEnd: string;
  openPeriodStart: string;
  projectId: string | number;
  query: string;
}

export function useDetectorAttributeComparison({
  query,
  aggregate,
  openPeriodStart,
  openPeriodEnd,
  projectId,
  isOpenPeriodLoading,
}: UseDetectorAttributeComparisonParams) {
  const organization = useOrganization();

  // Query 1: Open period (the "selected" cohort)
  const openPeriodQuery = new MutableSearch(query);
  openPeriodQuery.addFilterValue('timestamp', `>=${openPeriodStart}`);
  openPeriodQuery.addFilterValue('timestamp', `<=${openPeriodEnd}`);
  const query1 = openPeriodQuery.formatString();

  // Query 2: Full range (7d before open period start through open period end)
  // The endpoint subtracts cohort1 from cohort2 internally, so this yields
  // "7 days before the open period" as the effective baseline.
  const baselineStart = new Date(
    new Date(openPeriodStart).getTime() - BASELINE_DAYS * 24 * 60 * 60 * 1000
  );
  const baselineQuery = new MutableSearch(query);
  baselineQuery.addFilterValue('timestamp', `>=${getUtcDateString(baselineStart)}`);
  baselineQuery.addFilterValue('timestamp', `<=${openPeriodEnd}`);
  const query2 = baselineQuery.formatString();

  const start = getUtcDateString(baselineStart);
  const end = openPeriodEnd;

  const queryParams = useMemo(() => {
    return {
      project: [String(projectId)],
      start,
      end,
      query_1: query1,
      query_2: query2,
      dataset: 'spans',
      function: aggregate,
      above: 1,
      sampling: SAMPLING_MODE.NORMAL,
      aggregateExtrapolation: '1',
    };
  }, [projectId, start, end, query1, query2, aggregate]);

  return useApiQuery<AttributeBreakdownsComparison>(
    [
      getApiUrl('/organizations/$organizationIdOrSlug/trace-items/attributes/ranked/', {
        path: {organizationIdOrSlug: organization.slug},
      }),
      {query: queryParams},
    ],
    {
      staleTime: 0,
      enabled:
        !!aggregate && !!openPeriodStart && !!openPeriodEnd && !isOpenPeriodLoading,
    }
  );
}
