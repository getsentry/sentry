export interface DroppedEventsBucket {
  category: string;
  count: number;
  end: number;
  outcome: string;
  reason: string;
  start: number;
  type: string;
}

export interface DroppedDataProps {
  acceptedEvents?: DroppedEventsBucket[];
  droppedEvents?: DroppedEventsBucket[];
  onClick?: () => void;
}

export interface EventVolume {
  count: number;
}

export interface OutcomeVolume extends EventVolume {
  outcome: string;
}

/**
 * Dropped and accepted volume for one chart time bucket.
 */
export interface DroppedDataBucket {
  accepted: EventVolume;
  byOutcome: OutcomeVolume[];
  dropped: EventVolume;
  end: number;
  events: DroppedEventsBucket[];
  ratio: number;
  start: number;
}
