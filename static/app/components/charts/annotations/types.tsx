import type {TimeseriesAnnotation} from './timeseriesAnnotation';

export type AnnotationKind = 'release' | 'flag' | 'timeseriesAnnotation';

/**
 * Something that happened at a point in time and is drawn in the annotations
 * lane under a time series chart, whatever its source.
 */
export interface AnnotationItem {
  id: string;
  kind: AnnotationKind;
  start: number;
  title: string;
  environmentId?: TimeseriesAnnotation['environmentId'];
  severity?: TimeseriesAnnotation['severity'];
}
