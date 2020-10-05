import {t} from 'app/locale';

import {Vital, WebVital} from './types';

export const NUM_BUCKETS = 100;

export const PERCENTILE = 0.75;

export const WEB_VITAL_DETAILS: Record<WebVital, Vital> = {
  [WebVital.FP]: {
    slug: 'fp',
    name: t('First Paint'),
    description: t(
      'First paint refers to the point at which the first pixel renders on a screen after a user navigates to a web page.'
    ),
    failureThreshold: 4000,
    type: 'duration',
  },
  [WebVital.FCP]: {
    slug: 'fcp',
    name: t('First Contentful Paint'),
    description: t(
      'First Contentful Paint measures the time from when the page starts loading to when the page first rendered any content such as text and images.'
    ),
    failureThreshold: 4000,
    type: 'duration',
  },
  [WebVital.LCP]: {
    slug: 'lcp',
    name: t('Largest Contentful Paint'),
    description: t(
      'Largest Contentful Paint measures the render time of the largest image or text block prior to user input.'
    ),
    failureThreshold: 4000,
    type: 'duration',
  },
  [WebVital.FID]: {
    slug: 'fid',
    name: t('First Input Delay'),
    description: t(
      'First input delay measures the time from a user’s first interaction (such as clicks) to the time when the browser is able to respond to that interaction. Scrolling and zooming are not included in this metric.'
    ),
    failureThreshold: 300,
    type: 'duration',
  },
};
