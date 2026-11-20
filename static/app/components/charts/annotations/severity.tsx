import type {AnnotationItem} from './types';

export function isSevere(item: AnnotationItem): boolean {
  switch (item.kind) {
    case 'timeseriesAnnotation':
      return item.severity === 'high';
    case 'release':
    case 'flag':
      return false;
  }
}
