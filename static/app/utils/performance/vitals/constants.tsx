import {t} from 'sentry/locale';
import {measurementType} from 'sentry/utils/discover/fields';
import {MobileVital, WebVital} from 'sentry/utils/fields';
import {Vital} from 'sentry/utils/performance/vitals/types';

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
  [WebVital.REQUEST_TIME]: {
    slug: 'ttfb.requesttime',
    name: t('Request Time'),
    acronym: 'RT',
    description: t(
      'Captures the time spent making the request and receiving the first byte of the response.'
    ),
    poorThreshold: 600,
    type: measurementType(WebVital.REQUEST_TIME),
  },
};

export const MOBILE_VITAL_DETAILS: Record<MobileVital, Vital> = {
  [MobileVital.APP_START_COLD]: {
    slug: 'app_start_cold',
    name: t('App Start Cold'),
    description: t(
      'Cold start is a measure of the application start up time from scratch.'
    ),
    type: measurementType(MobileVital.APP_START_COLD),
  },
  [MobileVital.APP_START_WARM]: {
    slug: 'app_start_warm',
    name: t('App Start Warm'),
    description: t(
      'Warm start is a measure of the application start up time while still in memory.'
    ),
    type: measurementType(MobileVital.APP_START_WARM),
  },
  [MobileVital.FRAMES_TOTAL]: {
    slug: 'frames_total',
    name: t('Total Frames'),
    description: t(
      'Total frames is a count of the number of frames recorded within a transaction.'
    ),
    type: measurementType(MobileVital.FRAMES_TOTAL),
  },
  [MobileVital.FRAMES_SLOW]: {
    slug: 'frames_slow',
    name: t('Slow Frames'),
    description: t(
      'Slow frames is a count of the number of slow frames recorded within a transaction.'
    ),
    type: measurementType(MobileVital.FRAMES_SLOW),
  },
  [MobileVital.FRAMES_FROZEN]: {
    slug: 'frames_frozen',
    name: t('Frozen Frames'),
    description: t(
      'Frozen frames is a count of the number of frozen frames recorded within a transaction.'
    ),
    type: measurementType(MobileVital.FRAMES_FROZEN),
  },
  [MobileVital.FRAMES_SLOW_RATE]: {
    slug: 'frames_slow_rate',
    name: t('Slow Frames Rate'),
    description: t(
      'Slow Frames Rate is the percentage of frames recorded within a transaction that is considered slow.'
    ),
    type: measurementType(MobileVital.FRAMES_SLOW_RATE),
  },
  [MobileVital.FRAMES_FROZEN_RATE]: {
    slug: 'frames_frozen_rate',
    name: t('Frozen Frames Rate'),
    description: t(
      'Frozen Frames Rate is the percentage of frames recorded within a transaction that is considered frozen.'
    ),
    type: measurementType(MobileVital.FRAMES_FROZEN_RATE),
  },
  [MobileVital.STALL_COUNT]: {
    slug: 'stall_count',
    name: t('Stalls'),
    description: t(
      'Stalls is the number of times the application stalled within a transaction.'
    ),
    type: measurementType(MobileVital.STALL_COUNT),
  },
  [MobileVital.STALL_TOTAL_TIME]: {
    slug: 'stall_total_time',
    name: t('Total Stall Time'),
    description: t(
      'Stall Total Time is the total amount of time the application is stalled within a transaction.'
    ),
    type: measurementType(MobileVital.STALL_TOTAL_TIME),
  },
  [MobileVital.STALL_LONGEST_TIME]: {
    slug: 'stall_longest_time',
    name: t('Longest Stall Time'),
    description: t(
      'Stall Longest Time is the longest amount of time the application is stalled within a transaction.'
    ),
    type: measurementType(MobileVital.STALL_LONGEST_TIME),
  },
  [MobileVital.STALL_PERCENTAGE]: {
    slug: 'stall_percentage',
    name: t('Stall Percentage'),
    description: t(
      'Stall Percentage is the percentage of the transaction duration the application was stalled.'
    ),
    type: measurementType(MobileVital.STALL_PERCENTAGE),
  },
  [MobileVital.TIME_TO_FULL_DISPLAY]: {
    slug: 'time_to_full_display',
    name: t('Time To Full Display'),
    acronym: 'TTFD',
    description: t(
      'The time between application launch and complete display of all resources and views.'
    ),
    type: measurementType(MobileVital.TIME_TO_FULL_DISPLAY),
  },
  [MobileVital.TIME_TO_INITIAL_DISPLAY]: {
    slug: 'time_to_initial_display',
    name: t('Time To Initial Display'),
    acronym: 'TTID',
    description: t('The time it takes for an application to produce its first frame.'),
    poorThreshold: 2000,
    type: measurementType(MobileVital.TIME_TO_INITIAL_DISPLAY),
  },
};

export const VITAL_DETAILS = Object.assign({}, WEB_VITAL_DETAILS, MOBILE_VITAL_DETAILS);

export enum Browser {
  CHROME = 'Chrome',
  EDGE = 'Edge',
  OPERA = 'Opera',
  FIREFOX = 'Firefox',
  SAFARI = 'Safari',
  IE = 'IE',
}
