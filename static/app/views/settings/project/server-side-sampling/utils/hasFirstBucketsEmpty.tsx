import {SeriesApi} from 'sentry/types';
import {defined} from 'sentry/utils';

import {quantityField} from '.';

// Returns true if the first X time buckets are 0 in the series api response
export function hasFirstBucketsEmpty(
  stats: SeriesApi | undefined,
  numberOfLeadingEmptyBuckets = 3
) {
  if (!defined(stats)) {
    return false;
  }

  const numberOfEventsInTheFirstBuckets = stats.groups.reduce((acc, group) => {
    let groupAcc = 0;
    const series = group.series[quantityField];

    for (let i = 0; i < numberOfLeadingEmptyBuckets; i++) {
      groupAcc += series[i];
    }

    return acc + groupAcc;
  }, 0);

  return numberOfEventsInTheFirstBuckets === 0;
}
