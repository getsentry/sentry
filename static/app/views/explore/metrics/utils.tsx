import {useMemo} from 'react';

import usePageFilters from 'sentry/utils/usePageFilters';

export function metricsPickableDays() {
  const {selection} = usePageFilters();

  return useMemo(() => {
    const maxPickableDays = 30;

    const defaultPeriod = '7d';
    const relativeOptions = ({arbitraryOptions}) => ({
      ...arbitraryOptions,
      '1h': 'Last hour',
      '24h': 'Last 24 hours',
      '7d': 'Last 7 days',
      '14d': 'Last 14 days',
      '30d': 'Last 30 days',
    });

    return {
      defaultPeriod,
      maxPickableDays,
      relativeOptions,
    };
  }, []);
}
