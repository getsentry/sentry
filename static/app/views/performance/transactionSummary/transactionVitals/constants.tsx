import {WebVital} from 'sentry/utils/fields';
import {WEB_VITAL_DETAILS} from 'sentry/utils/performance/vitals/constants';
import {VitalGroup} from 'sentry/utils/performance/vitals/types';
import theme from 'sentry/utils/theme';

export const NUM_BUCKETS = 100;

export const PERCENTILE = 0.75;

/**
 * This defines the grouping for histograms. Histograms that are in the same group
 * will be queried together on initial load for alignment. However, the zoom controls
 * are defined for each measurement independently.
 */
const _VITAL_GROUPS = [
  {
    vitals: [WebVital.FP, WebVital.FCP, WebVital.LCP],
    min: 0,
  },
  {
    vitals: [WebVital.FID],
    min: 0,
    precision: 2,
  },
  {
    vitals: [WebVital.CLS],
    min: 0,
    precision: 2,
  },
];

const _COLORS = [
  ...theme.charts.getColorPalette(
    _VITAL_GROUPS.reduce((count, {vitals}) => count + vitals.length, 0) - 1
  ),
].reverse();

export const VITAL_GROUPS: VitalGroup[] = _VITAL_GROUPS.map(group => ({
  ...group,
  colors: _COLORS.splice(0, group.vitals.length),
}));

export const ZOOM_KEYS = _VITAL_GROUPS.reduce((keys: string[], {vitals}) => {
  vitals.forEach(vital => {
    const vitalSlug = WEB_VITAL_DETAILS[vital].slug;
    keys.push(`${vitalSlug}Start`);
    keys.push(`${vitalSlug}End`);
  });
  return keys;
}, []);
