import type {Annotation} from 'sentry/utils/timeSeries/useFetchEventsTimeSeries';

export interface DroppedDataProps {
  acceptedAnnotations?: Annotation[];
  droppedAnnotations?: Annotation[];
  onClick?: () => void;
}
