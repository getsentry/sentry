export type AnnotationKind = 'release' | 'flag' | 'change';

/**
 * Something that happened at a point in time and is drawn in the annotations
 * lane under a time series chart, whatever its source.
 */
export interface AnnotationItem {
  id: string;
  kind: AnnotationKind;
  start: number;
  title: string;
}
