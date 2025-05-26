import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {useReleaseSelection} from 'sentry/views/insights/common/queries/useReleases';
import {appendReleaseFilters} from 'sentry/views/insights/common/utils/releaseComparison';
import {useInsightsEap} from 'sentry/views/insights/common/utils/useEap';

import {useMetrics} from './useDiscover';

export function useTTFDConfigured(additionalFilters?: string[]) {
  const useEap = useInsightsEap();

  const {
    primaryRelease,
    secondaryRelease,
    isLoading: isReleasesLoading,
  } = useReleaseSelection();

  const query = new MutableSearch([
    useEap ? 'is_transaction:true' : 'event.type:transaction',
    'transaction.op:[ui.load,navigation]',
    ...(additionalFilters ?? []),
  ]);

  const queryString = appendReleaseFilters(query, primaryRelease, secondaryRelease);

  const result = useMetrics(
    {
      search: queryString,
      enabled: !isReleasesLoading,
      fields: [
        `avg(measurements.time_to_initial_display)`,
        `avg(measurements.time_to_full_display)`,
        'count()',
      ],
    },
    'insights.mobile.hasTTFDConfigured'
  );

  const data = result.data;

  const hasTTFD: boolean | undefined = data.length
    ? !(
        data[0]!['avg(measurements.time_to_initial_display)'] !== 0 &&
        data[0]!['avg(measurements.time_to_full_display)'] === 0
      )
    : undefined;

  return {...result, hasTTFD};
}
