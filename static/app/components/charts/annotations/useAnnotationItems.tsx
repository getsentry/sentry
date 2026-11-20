import {usePageFilters} from 'sentry/components/pageFilters/usePageFilters';
import {useReleaseStats} from 'sentry/utils/useReleaseStats';

import type {AnnotationItem, AnnotationKind} from './types';
import {useAnnotationFlagLog} from './useAnnotationFlagLog';

type AnnotationItemsByKind = Partial<Record<AnnotationKind, AnnotationItem[]>>;

export function useAnnotationItems({enabled}: {enabled: boolean}): AnnotationItemsByKind {
  const {selection} = usePageFilters();
  const {releases} = useReleaseStats(selection, {enabled});
  const {data: flagLog} = useAnnotationFlagLog({enabled});

  return {
    release: releases?.map(({date, version}): AnnotationItem => ({
      id: `release:${version}`,
      kind: 'release',
      start: new Date(date).getTime(),
      title: version,
    })),
    flag: flagLog?.map(({id, createdAt, flag}): AnnotationItem => ({
      id: `flag:${id}`,
      kind: 'flag',
      start: new Date(createdAt).getTime(),
      title: flag,
    })),
  };
}
