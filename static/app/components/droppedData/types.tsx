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
