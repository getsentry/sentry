type DroppedEventTag = 'intentional' | 'unintentional';

export interface DroppedEventsBucket {
  category: string;
  count: number;
  end: number;
  outcome: string;
  reason: string;
  start: number;
  tags: DroppedEventTag[];
  type: string;
}

export interface DroppedDataProps {
  acceptedEvents?: DroppedEventsBucket[];
  droppedEvents?: DroppedEventsBucket[];
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
