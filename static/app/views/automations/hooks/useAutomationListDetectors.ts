import {useMemo} from 'react';
import {useQueries, useQuery} from '@tanstack/react-query';
import chunk from 'lodash/chunk';
import {parseAsString, useQueryState} from 'nuqs';

import {usePageFilters} from 'sentry/components/pageFilters/usePageFilters';
import type {Detector} from 'sentry/types/workflowEngine/detectors';
import {parseAsSort} from 'sentry/utils/url/parseAsSort';
import {useOrganization} from 'sentry/utils/useOrganization';
import {AUTOMATION_LIST_PAGE_LIMIT} from 'sentry/views/automations/constants';
import {automationsApiOptions} from 'sentry/views/automations/hooks';
import {detectorListApiOptions} from 'sentry/views/detectors/hooks';

const MAX_DETECTORS_PER_REQUEST = 100;

export function useAutomationListQueryOptions() {
  const organization = useOrganization();
  const {selection, isReady} = usePageFilters();
  const [sort] = useQueryState(
    'sort',
    parseAsSort.withDefault({kind: 'desc', field: 'lastTriggered'})
  );
  const [query] = useQueryState('query', parseAsString.withDefault(''));
  const [cursor] = useQueryState('cursor', parseAsString.withDefault(''));

  return {
    queryOptions: automationsApiOptions(organization, {
      query,
      sortBy: sort ? `${sort?.kind === 'asc' ? '' : '-'}${sort?.field}` : undefined,
      projects: selection.projects,
      limit: AUTOMATION_LIST_PAGE_LIMIT,
      cursor,
    }),
    enabled: isReady,
    cursor,
    sort,
  };
}

interface UseAutomationListDetectorsResult {
  detectorsById: Map<string, Detector>;
  isError: boolean;
  isLoading: boolean;
}

export function useAutomationListDetectors(): UseAutomationListDetectorsResult {
  const organization = useOrganization();
  const {queryOptions, enabled} = useAutomationListQueryOptions();

  const {data: automations} = useQuery({
    ...queryOptions,
    enabled,
    staleTime: Infinity,
  });

  const detectorIds = useMemo(() => {
    if (!automations) {
      return [];
    }
    return [...new Set(automations.flatMap(a => a.detectorIds))];
  }, [automations]);

  const chunks = useMemo(
    () => chunk(detectorIds, MAX_DETECTORS_PER_REQUEST),
    [detectorIds]
  );

  const detectorQueries = useQueries({
    queries: chunks.map(ids =>
      detectorListApiOptions(organization, {
        ids,
        limit: MAX_DETECTORS_PER_REQUEST,
      })
    ),
  });

  const isLoading = detectorQueries.some(q => q.isLoading);
  const isError = detectorQueries.some(q => q.isError);

  const detectorsById = new Map<string, Detector>();
  for (const q of detectorQueries) {
    if (q.data) {
      for (const detector of q.data) {
        detectorsById.set(detector.id, detector);
      }
    }
  }

  return {detectorsById, isLoading, isError};
}
