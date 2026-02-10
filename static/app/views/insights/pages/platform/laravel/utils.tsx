import {useMemo} from 'react';

import {getInterval, type Fidelity} from 'sentry/components/charts/utils';
import {normalizeDateTimeParams} from 'sentry/components/pageFilters/parse';
import usePageFilters from 'sentry/components/pageFilters/usePageFilters';
import type {PageFilters} from 'sentry/types/core';

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
