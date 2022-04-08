import {SeriesApi} from 'sentry/types';

export enum Outcome {
  ACCEPTED = 'accepted',
  FILTERED = 'filtered',
  INVALID = 'invalid',
  DROPPED = 'dropped',
  RATE_LIMITED = 'rate_limited',
  CLIENT_DISCARD = 'client_discard',
}

/**
 * Raw response from API endpoint
 */
export type UsageSeries = SeriesApi & {
  end: string;
  start: string;
};

export type UsageStat = {
  accepted: number;
  date: string;
  dropped: {
    total: number;
    other?: number;
  };
  filtered: number;
  total: number;
};
