import {t} from 'sentry/locale';

import type {AnnotationKind} from './types';

export const ANNOTATION_KINDS: AnnotationKind[] = [
  'release',
  'flag',
  'timeseriesAnnotation',
];

export const ANNOTATION_KIND_LABELS: Record<AnnotationKind, string> = {
  release: t('Releases'),
  flag: t('Flags'),
  timeseriesAnnotation: t('Changes'),
};
