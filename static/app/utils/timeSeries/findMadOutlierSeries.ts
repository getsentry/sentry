import type {
  TimeSeries,
  TimeSeriesItem,
} from 'sentry/views/dashboards/widgets/common/types';

/**
 * Scales the median absolute deviation so that a score of 1 is about one
 * standard deviation for normally distributed values.
 */
const MAD_SCALE = 0.6745;

/**
 * Scales the mean absolute deviation the same way. It's used when more than
 * half the values equal the median, which makes the MAD zero.
 */
const MEAN_AD_SCALE = 1.2533;

/**
 * Fewest groups, not counting "Other", that are compared with each other.
 */
export const MIN_OUTLIER_PEERS = 3;

interface MadOutlierSeries {
  /**
   * Mean robust z-score of the series across the timestamps that could be scored
   */
  score: number;
  timeSeries: TimeSeries;
}

/**
 * Series compared with each other. "Other" sums every remaining group, so it
 * isn't a peer.
 */
export function getOutlierPeerSeries(series: readonly TimeSeries[]): TimeSeries[] {
  return series.filter(timeSeries => !timeSeries.meta.isOther);
}

interface FindMadOutlierSeriesOptions {
  /**
   * Divides each series by its own median before comparing, so groups are
   * compared by shape rather than size. Use it for aggregates that grow with
   * traffic, like `count()`, where the busiest group would otherwise always
   * stand out.
   */
  normalize?: boolean;
}

function median(values: number[]): number {
  const sorted = values.toSorted((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[middle - 1]! + sorted[middle]!) / 2
    : sorted[middle]!;
}

function isScorable(item: TimeSeriesItem): item is TimeSeriesItem & {value: number} {
  return item.value !== null && !item.incomplete && Number.isFinite(item.value);
}

/**
 * The typical size of a series: its median, or its mean when most values are
 * zero. Returns null when every value is zero, since such a series has no
 * shape to compare.
 */
function getSeriesScale(timeSeries: TimeSeries): number | null {
  const values = timeSeries.values.filter(isScorable).map(item => Math.abs(item.value));
  if (values.length === 0) {
    return null;
  }
  const center = median(values);
  if (center > 0) {
    return center;
  }
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  return mean > 0 ? mean : null;
}

/**
 * Finds the series that strays furthest from the other groups. At each
 * timestamp, every group's value is scored against the median and median
 * absolute deviation of all groups at that timestamp. The series with the
 * highest mean score is returned.
 *
 * With `normalize`, a series whose values are all zero is left out.
 *
 * When the MAD is zero, the mean absolute deviation is used instead.
 *
 * Missing and incomplete values are skipped, as are timestamps with fewer than
 * `MIN_OUTLIER_PEERS` values or where every value is the same.
 */
export function findMadOutlierSeries(
  series: readonly TimeSeries[],
  {normalize = false}: FindMadOutlierSeriesOptions = {}
): MadOutlierSeries | null {
  const peers = getOutlierPeerSeries(series);
  if (peers.length < MIN_OUTLIER_PEERS) {
    return null;
  }

  const valuesByTimestamp = new Map<number, Array<{peerIndex: number; value: number}>>();
  peers.forEach((timeSeries, peerIndex) => {
    const scale = normalize ? getSeriesScale(timeSeries) : 1;
    if (scale === null) {
      return;
    }
    for (const item of timeSeries.values) {
      if (!isScorable(item)) {
        continue;
      }
      const values = valuesByTimestamp.get(item.timestamp) ?? [];
      values.push({peerIndex, value: item.value / scale});
      valuesByTimestamp.set(item.timestamp, values);
    }
  });

  const totals = peers.map(() => ({sum: 0, count: 0}));
  for (const values of valuesByTimestamp.values()) {
    if (values.length < MIN_OUTLIER_PEERS) {
      continue;
    }
    const center = median(values.map(({value}) => value));
    const deviations = values.map(({value}) => Math.abs(value - center));
    const mad = median(deviations);
    const meanAd = deviations.reduce((sum, value) => sum + value, 0) / deviations.length;
    if (meanAd === 0) {
      continue;
    }
    values.forEach(({peerIndex}, index) => {
      const deviation = deviations[index]!;
      totals[peerIndex]!.sum +=
        mad > 0 ? (MAD_SCALE * deviation) / mad : deviation / (MEAN_AD_SCALE * meanAd);
      totals[peerIndex]!.count += 1;
    });
  }

  let outlier: MadOutlierSeries | null = null;
  totals.forEach(({sum, count}, peerIndex) => {
    if (count === 0) {
      return;
    }
    const score = sum / count;
    if (!outlier || score > outlier.score) {
      outlier = {score, timeSeries: peers[peerIndex]!};
    }
  });
  return outlier;
}
