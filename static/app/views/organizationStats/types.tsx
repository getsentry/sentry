import type {getInterval} from 'sentry/components/charts/utils';
import type {SeriesApi} from 'sentry/types/organization';

export type IntervalPeriod = ReturnType<typeof getInterval>;

/**
 * Raw response from API endpoint
 */
export interface UsageSeries extends SeriesApi {
  // index signature is present because we often send this
  // data to sentry as part of the event context.
  end: string;
  start: string;
}

export type UsageStat = {
  accepted: number;
  accepted_stored: number;
  clientDiscard: number;
  date: string;
  filtered: number;
  invalid: number;
  rateLimited: number;
  total: number;
};
