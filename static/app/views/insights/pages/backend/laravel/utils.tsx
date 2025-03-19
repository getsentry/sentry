import {useMemo} from 'react';

import {type Fidelity, getInterval} from 'sentry/components/charts/utils';
import {normalizeDateTimeParams} from 'sentry/components/organizations/pageFilters/parse';
import usePageFilters from 'sentry/utils/usePageFilters';

export function usePageFilterChartParams({
  granularity = 'spans',
}: {
  granularity?: Fidelity;
} = {}) {
  const {selection} = usePageFilters();

  const normalizedDateTime = useMemo(
    () => normalizeDateTimeParams(selection.datetime),
    [selection.datetime]
  );

  return {
    ...normalizedDateTime,
    interval: getInterval(selection.datetime, granularity),
    project: selection.projects,
  };
}
