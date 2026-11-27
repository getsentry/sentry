import {usePageFilters} from 'sentry/components/pageFilters/usePageFilters';
import type {DiscoverDatasets} from 'sentry/utils/discover/types';
import {useReleaseStats} from 'sentry/utils/useReleaseStats';

import {timeseriesAnnotationEnd} from './timeseriesAnnotation';
import type {AnnotationItem, AnnotationKind} from './types';
import {useAnnotationFlagLog} from './useAnnotationFlagLog';
import {useTimeseriesAnnotations} from './useTimeseriesAnnotations';

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
  const {selection} = usePageFilters();
  const {releases} = useReleaseStats(selection, {enabled});
  const {data: flagLog} = useAnnotationFlagLog({enabled});
  const timeseriesAnnotations = useTimeseriesAnnotations({dataset, interval, enabled});

  return {
    release: releases?.map(({date, version}): AnnotationItem => ({
      id: `release:${version}`,
      kind: 'release',
      start: new Date(date).getTime(),
      title: version,
    })),
    flag: flagLog?.map(({id, action, createdAt, flag}): AnnotationItem => ({
      id: `flag:${id}`,
      kind: 'flag',
      start: new Date(createdAt).getTime(),
      title: flag,
      action,
    })),
    timeseriesAnnotation: timeseriesAnnotations?.map((annotation): AnnotationItem => ({
      id: `timeseriesAnnotation:${annotation.id}`,
      kind: 'timeseriesAnnotation',
      start: new Date(annotation.startTimestamp).getTime(),
      end: timeseriesAnnotationEnd(annotation),
      title: annotation.description,
      annotationType: annotation.annotationType,
      environmentId: annotation.environmentId,
      severity: annotation.severity,
    })),
  };
}
