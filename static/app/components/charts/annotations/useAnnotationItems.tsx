import {usePageFilters} from 'sentry/components/pageFilters/usePageFilters';
import type {DiscoverDatasets} from 'sentry/utils/discover/types';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useReleaseStats} from 'sentry/utils/useReleaseStats';

import {
  isTimeseriesAnnotationTypeEnabled,
  timeseriesAnnotationEnd,
  type TimeseriesAnnotation,
} from './timeseriesAnnotation';
import type {AnnotationItem, AnnotationKind} from './types';
import {useTimeseriesAnnotations} from './useTimeseriesAnnotations';

const FLAG_CHANGE_TYPE: TimeseriesAnnotation['annotationType'] = 'feature_flag_change';

type AnnotationItemsByKind = Partial<Record<AnnotationKind, AnnotationItem[]>>;

interface UseAnnotationItemsParams {
  dataset: DiscoverDatasets;
  enabled: boolean;
  interval: string;
}

export function useAnnotationItems({
  dataset,
  interval,
  enabled,
}: UseAnnotationItemsParams): AnnotationItemsByKind {
  const organization = useOrganization();
  const {selection} = usePageFilters();
  const {releases} = useReleaseStats(selection, {enabled});
  const timeseriesAnnotations = useTimeseriesAnnotations({
    dataset,
    interval,
    enabled,
  })?.filter(annotation =>
    isTimeseriesAnnotationTypeEnabled(annotation.annotationType, organization)
  );
  const areFlagChangesEnabled = isTimeseriesAnnotationTypeEnabled(
    FLAG_CHANGE_TYPE,
    organization
  );

  return {
    release: releases?.map(({date, version}): AnnotationItem => ({
      id: `release:${version}`,
      kind: 'release',
      start: new Date(date).getTime(),
      title: version,
    })),
    flag: areFlagChangesEnabled
      ? timeseriesAnnotations
          ?.filter(annotation => annotation.annotationType === FLAG_CHANGE_TYPE)
          .map(({id, startTimestamp, description, tags}): AnnotationItem => ({
            id: `flag:${id}`,
            kind: 'flag',
            start: new Date(startTimestamp).getTime(),
            title: typeof tags?.flag === 'string' ? tags.flag : description,
            action: typeof tags?.action === 'string' ? tags.action : undefined,
          }))
      : undefined,
    timeseriesAnnotation: timeseriesAnnotations
      ?.filter(annotation => annotation.annotationType !== FLAG_CHANGE_TYPE)
      .map((annotation): AnnotationItem => ({
        id: `timeseriesAnnotation:${annotation.id}`,
        kind: 'timeseriesAnnotation',
        start: new Date(annotation.startTimestamp).getTime(),
        end: timeseriesAnnotationEnd(annotation),
        title: annotation.description,
        annotationType: annotation.annotationType,
        environmentId: annotation.environmentId,
        pinned: annotation.pinned,
        severity: annotation.severity,
      })),
  };
}
