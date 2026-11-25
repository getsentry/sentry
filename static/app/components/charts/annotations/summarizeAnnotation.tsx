import type {ReactNode} from 'react';

import {Tag} from '@sentry/scraps/badge';
import {formatDateTime} from '@sentry/scraps/dateTime';
import type {TagVariant} from '@sentry/scraps/theme';

import {formatTimeRange} from 'sentry/components/charts/bands/chartBandTooltip';
import {getFlagActionLabel} from 'sentry/components/featureFlags/utils';
import {t} from 'sentry/locale';
import {defined} from 'sentry/utils/defined';
import {getExactDuration} from 'sentry/utils/duration/getExactDuration';

import {
  TIMESERIES_ANNOTATION_TYPE_LABELS,
  type TimeseriesAnnotation,
} from './timeseriesAnnotation';
import type {AnnotationItem} from './types';

const SEVERITY_TAGS: Record<
  TimeseriesAnnotation['severity'],
  {label: string; variant: TagVariant}
> = {
  low: {label: t('Low'), variant: 'muted'},
  medium: {label: t('Medium'), variant: 'warning'},
  high: {label: t('High'), variant: 'danger'},
};

export function formatAnnotationTime(
  {start, end}: AnnotationItem,
  timezone: string
): string {
  const startTime = formatDateTime(start, {timezone, showTimezone: true});
  if (end === 'ongoing') {
    return t('%s - Ongoing', startTime);
  }
  if (defined(end) && end > start) {
    return `${formatTimeRange(start, end, timezone)} (${getExactDuration((end - start) / 1000)})`;
  }
  return startTime;
}

interface AnnotationSummary {
  heading: string;
  description?: string;
  tag?: ReactNode;
}

export function summarizeAnnotation(item: AnnotationItem): AnnotationSummary {
  switch (item.kind) {
    case 'timeseriesAnnotation': {
      const severity = item.severity ? SEVERITY_TAGS[item.severity] : undefined;
      return {
        heading: item.annotationType
          ? TIMESERIES_ANNOTATION_TYPE_LABELS[item.annotationType]
          : t('Change'),
        description: item.title,
        tag: severity ? <Tag variant={severity.variant}>{severity.label}</Tag> : null,
      };
    }
    case 'release':
      return {heading: t('Release'), description: item.title};
    case 'flag':
      return {
        heading: item.title,
        tag: item.action ? getFlagActionLabel(item.action) : null,
      };
  }
}
