import round from 'lodash/round';

import {Outcome, SeriesApi} from 'sentry/types';
import {findClosestNumber} from 'sentry/utils/findClosestNumber';

import {quantityField} from '.';

const MAX_PER_HOUR = 300 * 60 * 60;
const COMMON_SAMPLE_RATES = [
  0.01, 0.015, 0.02, 0.025, 0.03, 0.035, 0.04, 0.045, 0.05, 0.06, 0.07, 0.08, 0.09, 0.1,
  0.15, 0.2, 0.25, 0.3, 0.35, 0.4, 0.45, 0.5, 0.55, 0.6, 0.65, 0.7, 0.75, 0.8, 0.85, 0.9,
  0.95, 1,
].sort((a, z) => a - z);

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

  let trueSampleRate = trueSampleRates[Math.floor(trueSampleRates.length / 2)];
  if (trueSampleRate > COMMON_SAMPLE_RATES[0]) {
    trueSampleRate = findClosestNumber(trueSampleRate, COMMON_SAMPLE_RATES);
  }

  let maxSafeSampleRate = safeSampleRates[0];
  if (maxSafeSampleRate > COMMON_SAMPLE_RATES[0]) {
    maxSafeSampleRate = findClosestNumber(maxSafeSampleRate, COMMON_SAMPLE_RATES);
  }

  return {
    trueSampleRate: round(trueSampleRate, 4),
    maxSafeSampleRate: round(maxSafeSampleRate, 4),
    hoursOverLimit,
  };
}
