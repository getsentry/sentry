import {getDuration} from '@sentry/scraps/duration';

import {t} from 'sentry/locale';

export const WEB_VITALS_METERS_CONFIG = {
  lcp: {
    name: t('Largest Contentful Paint'),
    formatter: (value: number) => getFormattedDuration(value / 1000),
  },
  fcp: {
    name: t('First Contentful Paint'),
    formatter: (value: number) => getFormattedDuration(value / 1000),
  },
  inp: {
    name: t('Interaction to Next Paint'),
    formatter: (value: number) => getFormattedDuration(value / 1000),
  },
  cls: {
    name: t('Cumulative Layout Shift'),
    formatter: (value: number) => Math.round(value * 100) / 100,
  },
  ttfb: {
    name: t('Time To First Byte'),
    formatter: (value: number) => getFormattedDuration(value / 1000),
  },
};
export const getFormattedDuration = (value: number) => {
  return getDuration(value, {precision: value < 1 ? 0 : 2, style: 'short'});
};
