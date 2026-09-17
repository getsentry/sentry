import {useMemo} from 'react';

import {getInterval} from 'sentry/components/charts/utils';
import {normalizeDateTimeParams} from 'sentry/components/pageFilters/parse';
import {usePageFilters} from 'sentry/components/pageFilters/usePageFilters';

export function usePageFilterChartParams() {
  const pageFilterContext = usePageFilters();
  const selection = pageFilterContext.selection;

  const normalizedDateTime = useMemo(
    () => normalizeDateTimeParams(selection.datetime),
    [selection.datetime]
  );

  return {
    ...normalizedDateTime,
    interval: getInterval(selection.datetime, 'spans'),
    project: selection.projects,
    environment: selection.environments,
  };
}
