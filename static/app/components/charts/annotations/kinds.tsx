import type {ComponentType} from 'react';
import {IconFlag} from '@sentry/icons/flag';
import {IconLightning} from '@sentry/icons/lightning';
import {IconReleases} from '@sentry/icons/releases';
import type {SVGIconProps} from '@sentry/icons/svgIcon';

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

export const ANNOTATION_KIND_ICONS: Record<
  AnnotationKind,
  ComponentType<SVGIconProps>
> = {release: IconReleases, flag: IconFlag, timeseriesAnnotation: IconLightning};
