import type {EmbedOutput} from 'sentry/components/seer/markdown/embeds/utils';
import {t} from 'sentry/locale';

type ChartPoint = EmbedOutput<'chart'>['series'][number]['data'][number];

/**
 * Whether a transformation produced the point's value. A point with neither
 * flag, including every point written before the flags existed, is observed.
 */
export function isDerivedChartPoint(point: ChartPoint): boolean {
  return Boolean(point.filled || point.smoothed);
}

export function describeChartPointProvenance(point: ChartPoint): string | null {
  if (point.filled && point.smoothed) {
    return t('filled, smoothed');
  }
  if (point.smoothed) {
    return t('smoothed');
  }
  if (point.filled) {
    return t('filled');
  }
  return null;
}
