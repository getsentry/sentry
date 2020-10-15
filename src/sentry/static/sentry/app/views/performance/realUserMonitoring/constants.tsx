import {t} from 'app/locale';
import {WebVital, measurementType} from 'app/utils/discover/fields';
import {SelectValue} from 'app/types';
import theme from 'app/utils/theme';

import {Vital} from './types';

export const NUM_BUCKETS = 100;

export const PERCENTILE = 0.75;

export const WEB_VITAL_DETAILS: Record<WebVital, Vital> = {
  [WebVital.FP]: {
    slug: 'fp',
    name: t('First Paint'),
    description: t(
      'Render time of the first pixel loaded in the viewport (may overlap with FCP).'
    ),
    failureThreshold: 4000,
    type: measurementType(WebVital.FP),
  },
  [WebVital.FCP]: {
    slug: 'fcp',
    name: t('First Contentful Paint'),
    description: t(
      'Render time of the first image, text or other DOM node in the viewport.'
    ),
    failureThreshold: 4000,
    type: measurementType(WebVital.FCP),
  },
  [WebVital.LCP]: {
    slug: 'lcp',
    name: t('Largest Contentful Paint'),
    description: t(
      'Render time of the largest image, text or other DOM node in the viewport.'
    ),
    failureThreshold: 4000,
    type: measurementType(WebVital.LCP),
  },
  [WebVital.FID]: {
    slug: 'fid',
    name: t('First Input Delay'),
    description: t(
      'Response time of the browser to a user interaction (clicking, tapping, etc).'
    ),
    failureThreshold: 300,
    type: measurementType(WebVital.FID),
  },
  [WebVital.CLS]: {
    slug: 'cls',
    name: t('Cumulative Layout Shift'),
    description: t(
      'The sum total of all individual layout shift scores for every unexpected layout shift that occurs during the entire lifespan of the page.'
    ),
    failureThreshold: 0.1,
    type: measurementType(WebVital.CLS),
  },
  [WebVital.TTFB]: {
    slug: 'ttfb',
    name: t('Time to First Byte'),
    description: t(
      "The time that it takes for a user's browser to receive the first byte of page content."
    ),
    failureThreshold: 600,
    type: measurementType(WebVital.TTFB),
  },
  [WebVital.RequestTime]: {
    slug: 'ttfb.requesttime',
    name: t('Request Time'),
    description: t(
      'Captures the time spent making the request and receiving the first byte of the response.'
    ),
    failureThreshold: 600,
    type: measurementType(WebVital.TTFB),
  },
};

export const FILTER_OPTIONS: SelectValue<string>[] = [
  {label: t('Exclude Outliers'), value: 'exclude_outliers'},
  {label: t('View All'), value: 'all'},
];

export const ZOOM_KEYS = Object.values(WebVital).reduce((zoomKeys: string[], vital) => {
  const vitalSlug = WEB_VITAL_DETAILS[vital].slug;
  zoomKeys.push(`${vitalSlug}Start`);
  zoomKeys.push(`${vitalSlug}End`);
  return zoomKeys;
}, []);

/**
 * This defines the grouping for histograms. Histograms that are in the same group
 * will be queried together on initial load for alignment. However, the zoom controls
 * are defined for each measurement independently.
 */
const _COLORS = [
  ...theme.charts.getColorPalette(Object.values(WebVital).length - 1),
].reverse();
export const VITAL_GROUPS = [
  [WebVital.FP, WebVital.FCP, WebVital.LCP],
  [WebVital.FID],
].map(group => ({
  group,
  colors: _COLORS.splice(0, group.length),
}));
