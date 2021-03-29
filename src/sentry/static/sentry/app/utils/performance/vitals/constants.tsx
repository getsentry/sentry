import {t} from 'app/locale';
import {measurementType, WebVital} from 'app/utils/discover/fields';
import {Vital} from 'app/utils/performance/vitals/types';

export const WEB_VITAL_DETAILS: Record<WebVital, Vital> = {
  [WebVital.FP]: {
    slug: 'fp',
    name: t('First Paint'),
    acronym: 'FP',
    description: t(
      'Render time of the first pixel loaded in the viewport (may overlap with FCP).'
    ),
    poorThreshold: 3000,
    type: measurementType(WebVital.FP),
  },
  [WebVital.FCP]: {
    slug: 'fcp',
    name: t('First Contentful Paint'),
    acronym: 'FCP',
    description: t(
      'Render time of the first image, text or other DOM node in the viewport.'
    ),
    poorThreshold: 3000,
    type: measurementType(WebVital.FCP),
  },
  [WebVital.LCP]: {
    slug: 'lcp',
    name: t('Largest Contentful Paint'),
    acronym: 'LCP',
    description: t(
      'Render time of the largest image, text or other DOM node in the viewport.'
    ),
    poorThreshold: 4000,
    type: measurementType(WebVital.LCP),
  },
  [WebVital.FID]: {
    slug: 'fid',
    name: t('First Input Delay'),
    acronym: 'FID',
    description: t(
      'Response time of the browser to a user interaction (clicking, tapping, etc).'
    ),
    poorThreshold: 300,
    type: measurementType(WebVital.FID),
  },
  [WebVital.CLS]: {
    slug: 'cls',
    name: t('Cumulative Layout Shift'),
    acronym: 'CLS',
    description: t(
      'Sum of layout shift scores that measure the visual stability of the page.'
    ),
    poorThreshold: 0.25,
    type: measurementType(WebVital.CLS),
  },
  [WebVital.TTFB]: {
    slug: 'ttfb',
    name: t('Time to First Byte'),
    acronym: 'TTFB',
    description: t(
      "The time that it takes for a user's browser to receive the first byte of page content."
    ),
    poorThreshold: 600,
    type: measurementType(WebVital.TTFB),
  },
  [WebVital.RequestTime]: {
    slug: 'ttfb.requesttime',
    name: t('Request Time'),
    acronym: 'RT',
    description: t(
      'Captures the time spent making the request and receiving the first byte of the response.'
    ),
    poorThreshold: 600,
    type: measurementType(WebVital.RequestTime),
  },
};
