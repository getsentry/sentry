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
      'First Contentful Paint measures the time from when the page starts loading to when the page first rendered any text, image (including background images), non-white canvas or SVG. This excludes any content of iframes, but includes text with pending webfonts. '
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
      'First input delay (FID) measures the time from when a user first interacts with your site (i.e. when they click a link, tap on a button, or use a custom, JavaScript-powered control) to the time when the browser is actually able to respond to that interaction. It is the length of time, in milliseconds, between the first user interaction on a web page and the browser’s response to that interaction. Scrolling and zooming are not included in this metric.'
    ),
    failureThreshold: 300,
    type: 'duration',
  },
};
