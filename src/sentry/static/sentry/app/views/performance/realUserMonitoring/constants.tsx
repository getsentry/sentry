import {t} from 'app/locale';

import {Vital, WebVital} from './types';

export const NUM_BUCKETS = 50;

export const PERCENTILE = 0.75;

export const DURATION_VITALS = [WebVital.FCP, WebVital.LCP, WebVital.FID];

export const NON_DURATION_VITALS = [WebVital.CLS];

export const WEB_VITAL_DETAILS: Record<WebVital, Vital> = {
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
  [WebVital.CLS]: {
    slug: 'cls',
    name: t('Cumulative Layout Shift'),
    description: t(
      'This measures the significance of unexpected layout shifts in a page.'
    ),
    failureThreshold: 0.25,
    type: 'number',
  },
};
