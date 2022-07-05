import round from 'lodash/round';

import {SeriesApi} from 'sentry/types';
import {Outcome} from 'sentry/views/organizationStats/types';

import {quantityField} from '.';

const MAX_PER_HOUR = 100 * 60 * 60;

export function projectStatsToSampleRates(stats: SeriesApi | undefined): {
  hoursOverLimit?: number;
  maxSafeSampleRate?: number;
  trueSampleRate?: number;
} {
  if (!stats) {
    return {
      trueSampleRate: undefined,
      maxSafeSampleRate: undefined,
      hoursOverLimit: undefined,
    };
  }

  const {groups, intervals} = stats;
  const hours: number[] = [];
  const trueSampleRates: number[] = [];
  const safeSampleRates: number[] = [];
  let hoursOverLimit = 0;

  // We do not take filtered and invalid into account
  const accepted = groups.find(g => g.by.outcome === Outcome.ACCEPTED)?.series[
    quantityField
  ];
  const clientDiscard = groups.find(g => g.by.outcome === Outcome.CLIENT_DISCARD)?.series[
    quantityField
  ];
  const rateLimited = groups.find(g => g.by.outcome === Outcome.RATE_LIMITED)?.series[
    quantityField
  ];

  intervals.forEach((_interval, index) => {
    const hourAccepted = accepted?.[index] ?? 0;
    const hourClientDiscard = clientDiscard?.[index] ?? 0;
    const hourRateLimited = rateLimited?.[index] ?? 0;

    const hourRejected = hourClientDiscard + hourRateLimited;
    const hourTotal = hourAccepted + hourRejected;
    const hourTotalCapped = Math.min(hourTotal, MAX_PER_HOUR);
    const trueSampleRate = hourTotal === 0 ? 1 : 1 - hourRejected / hourTotal;
    const safeSampleRate = hourTotal === 0 ? 1 : hourTotalCapped / hourTotal;

    hours.push(hourTotal);
    trueSampleRates.push(trueSampleRate);
    safeSampleRates.push(safeSampleRate);
    if (hourTotal > MAX_PER_HOUR) {
      hoursOverLimit += 1;
    }
  });

  hours.sort((a, z) => a - z);
  trueSampleRates.sort((a, z) => a - z);
  safeSampleRates.sort((a, z) => a - z);

  const trueSampleRate = round(
    trueSampleRates[Math.floor(trueSampleRates.length / 2)],
    4
  );
  const maxSafeSampleRate = round(safeSampleRates[0], 4);

  return {
    trueSampleRate,
    maxSafeSampleRate,
    hoursOverLimit,
  };
}
