import type {DiscoverDatasets} from 'sentry/utils/discover/types';

type OutcomeTag = 'intentional' | 'unintentional';

export interface OutcomeRow {
  category: string;
  count: number;
  end: number;
  outcome: string;
  reason: string;
  start: number;
  tags: OutcomeTag[];
  type: string;
}

export interface DroppedDataProps {
  dataset: DiscoverDatasets;
  acceptedEvents?: OutcomeRow[];
  droppedEvents?: OutcomeRow[];
  onClick?: () => void;
}

export interface OutcomeVolume {
  count: number;
  outcome: string;
}

/**
 * Dropped and accepted volume for one chart time bucket.
 */
export interface DroppedDataBucket {
  accepted: number;
  byOutcome: OutcomeVolume[];
  dropped: number;
  end: number;
  ratio: number;
  start: number;
}
