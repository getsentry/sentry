import React from 'react';

import {IconLocation} from 'app/icons';
import {t} from 'app/locale';
import {WebVital, measurementType} from 'app/utils/discover/fields';
import {SelectValue} from 'app/types';

import {VitalDetails, Condition, ConditionDetails} from './types';

export const NUM_BUCKETS = 100;

export const PERCENTILE = 0.75;

export const WEB_VITAL_DETAILS: Record<WebVital, VitalDetails> = {
  [WebVital.FP]: {
    slug: 'fp',
    name: t('First Paint'),
    description: t('Render time of the first pixel loaded in the viewport.'),
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
};

export const FILTER_OPTIONS: SelectValue<string>[] = [
  {label: t('Exclude Outliers'), value: 'exclude_outliers'},
  {label: t('View All'), value: 'all'},
];

export const CONDITION_DETAILS: Record<Condition, ConditionDetails> = {
  [Condition.Region]: {
    icon: <IconLocation />,
    label: t('Region'),
    description: '[percentage] in [value]',
    tag: 'geo.region',
  },
  [Condition.Browser]: {
    icon: <IconLocation />,
    label: t('Browser Specs'),
    description: '[percentage] with [value]',
    tag: 'browser',
  },
  [Condition.HTTPStatus]: {
    icon: <IconLocation />,
    label: t('HTTP Status'),
    description: '[percentage] with [value]',
    tag: 'http.status_code',
  },
  [Condition.Device]: {
    icon: <IconLocation />,
    label: t('Device Specs'),
    description: '[percentage] with [value]',
    tag: 'device',
  },
  [Condition.Environment]: {
    icon: <IconLocation />,
    label: t('Environment'),
    description: '[percentage] in [value]',
    tag: 'environment',
  },
  [Condition.Release]: {
    icon: <IconLocation />,
    label: t('Release'),
    description: '[percentage] from [value]',
    tag: 'release',
  },
};
