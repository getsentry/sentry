import {SeriesApi} from 'app/types';

export enum Outcome {
  ACCEPTED = 'accepted',
  FILTERED = 'filtered',
  INVALID = 'invalid',
  DROPPED = 'dropped',
  RATE_LIMITED = 'rate_limited',
}

/**
 * Raw response from API endpoint
 */
export type UsageSeries = SeriesApi & {
  start: string;
  end: string;
};

export type UsageStat = {
  date: string;
  total: number;
  accepted: number;
  filtered: number;
  dropped: {
    total: number;
    other?: number;
  };
};
