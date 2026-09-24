import type {
  Annotation,
  EventsTimeSeriesResponse,
} from 'sentry/utils/timeSeries/useFetchEventsTimeSeries';

interface DroppedData {
  acceptedAnnotations?: Annotation[];
  droppedAnnotations?: Annotation[];
}

// TODO: this hook atm is very simple and almost needless. This is forward thinking to
// when we soon have a dedicated endpoint. The usage then should look something like
// this:
// function useDroppedData(params: {dataset; query; interval; enabled}): {
//   acceptedAnnotations?: Annotation[];
//   droppedAnnotations?: Annotation[];
//   isPending: boolean;
// };
export function useDroppedData(meta: EventsTimeSeriesResponse['meta']): DroppedData {
  return {
    droppedAnnotations: meta?.droppedAnnotations,
    acceptedAnnotations: meta?.acceptedAnnotations,
  };
}
