import {t} from 'app/locale';
import {SelectValue} from 'app/types';
import {WebVital} from 'app/utils/discover/fields';
import {DataFilter} from 'app/utils/performance/histogram/types';
import {WEB_VITAL_DETAILS} from 'app/utils/performance/vitals/constants';
import {VitalGroup} from 'app/utils/performance/vitals/types';
import theme from 'app/utils/theme';

export const NUM_BUCKETS = 100;

export const PERCENTILE = 0.75;

export const FILTER_OPTIONS: SelectValue<DataFilter>[] = [
  {label: t('Exclude Outliers'), value: 'exclude_outliers'},
  {label: t('View All'), value: 'all'},
];

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
