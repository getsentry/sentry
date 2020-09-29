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
      'This is the first moment DOM content such as text or an image gets rendered.'
    ),
    failureThreshold: 4000,
    type: 'duration',
  },
  [WebVital.LCP]: {
    slug: 'lcp',
    name: t('Largest Contentful Paint'),
    description: t('This is when the largest content element gets rendered in the page.'),
    failureThreshold: 4000,
    type: 'duration',
  },
  [WebVital.FID]: {
    slug: 'fid',
    name: t('First Input Delay'),
    description: t(
      'This is the first moment a user interacts with the page by clicking, scrolling, etc.'
    ),
    failureThreshold: 300,
    type: 'duration',
  },
};
