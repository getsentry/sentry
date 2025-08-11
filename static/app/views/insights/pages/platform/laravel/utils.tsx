import {useMemo} from 'react';

import {type Fidelity, getInterval} from 'sentry/components/charts/utils';
import {normalizeDateTimeParams} from 'sentry/components/organizations/pageFilters/parse';
import type {PageFilters} from 'sentry/types/core';
import usePageFilters from 'sentry/utils/usePageFilters';

export function usePageFilterChartParams({
  granularity = 'spans',
  pageFilters,
}: {
  granularity?: Fidelity;
  pageFilters?: PageFilters;
} = {}) {
  const pageFilterContext = usePageFilters();
  const selection = pageFilters || pageFilterContext.selection;

  const normalizedDateTime = useMemo(
    () => normalizeDateTimeParams(selection.datetime),
    [selection.datetime]
  );

  return {
    ...normalizedDateTime,
    interval: getInterval(selection.datetime, granularity),
    project: selection.projects,
    environment: selection.environments,
  };
}
