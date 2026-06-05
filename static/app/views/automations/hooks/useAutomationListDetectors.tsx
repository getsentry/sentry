import {useMemo} from 'react';
import {useQuery} from '@tanstack/react-query';

import {usePageFilters} from 'sentry/components/pageFilters/usePageFilters';
import type {Detector} from 'sentry/types/workflowEngine/detectors';
import {decodeScalar, decodeSorts} from 'sentry/utils/queryString';
import {useLocationQuery} from 'sentry/utils/url/useLocationQuery';
import {useOrganization} from 'sentry/utils/useOrganization';
import {AUTOMATION_LIST_PAGE_LIMIT} from 'sentry/views/automations/constants';
import {automationsApiOptions} from 'sentry/views/automations/hooks';
import {detectorListApiOptions} from 'sentry/views/detectors/hooks';

interface UseAutomationListDetectorsResult {
  detectorsById: Map<string, Detector>;
  isError: boolean;
  isLoading: boolean;
}

export function useAutomationListDetectors(): UseAutomationListDetectorsResult {
  const organization = useOrganization();
  const {selection, isReady} = usePageFilters();
  const {
    sort: sorts,
    query,
    cursor,
  } = useLocationQuery({
    fields: {
      sort: decodeSorts,
      query: decodeScalar,
      cursor: decodeScalar,
    },
  });
  const sort = sorts[0] ?? {kind: 'desc', field: 'lastTriggered'};

  const {data: automations} = useQuery({
    ...automationsApiOptions(organization, {
      query,
      sortBy: sort ? `${sort?.kind === 'asc' ? '' : '-'}${sort?.field}` : undefined,
      projects: selection.projects,
      limit: AUTOMATION_LIST_PAGE_LIMIT,
      cursor,
    }),
    enabled: isReady,
  });

  const detectorIds = useMemo(() => {
    if (!automations) {
      return [];
    }
    return [...new Set(automations.flatMap(a => a.detectorIds))];
  }, [automations]);

  const {data, isLoading, isError} = useQuery({
    ...detectorListApiOptions(organization, {
      ids: detectorIds,
      limit: detectorIds.length,
    }),
    enabled: detectorIds.length > 0,
  });

  const detectorsById = useMemo(() => {
    const map = new Map<string, Detector>();
    if (!data) {
      return map;
    }
    for (const detector of data) {
      map.set(detector.id, detector);
    }
    return map;
  }, [data]);

  return {detectorsById, isLoading, isError};
}
