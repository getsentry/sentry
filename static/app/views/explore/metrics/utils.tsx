import type {ReactNode} from 'react';

import {t} from 'sentry/locale';
import type {PickableDays} from 'sentry/views/explore/utils';

export function metricsPickableDays(): PickableDays {
  const maxPickableDays = 30 as const;
  const defaultPeriod = '7d' as const;

  const relativeOptions = ({
    arbitraryOptions,
  }: {
    arbitraryOptions: Record<string, ReactNode>;
  }) => ({
    ...arbitraryOptions,
    '1h': t('Last hour'),
    '24h': t('Last 24 hours'),
    '7d': t('Last 7 days'),
    '14d': t('Last 14 days'),
    '30d': t('Last 30 days'),
  });

  return {
    defaultPeriod,
    maxPickableDays,
    relativeOptions,
  };
}
