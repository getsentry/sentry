import {useQuery} from '@tanstack/react-query';
import {useQueryStates} from 'nuqs';

import {usePageFilters} from 'sentry/components/pageFilters/usePageFilters';
import type {DetectorType} from 'sentry/types/workflowEngine/detectors';
import {selectJsonWithHeaders} from 'sentry/utils/api/apiOptions';
import {useOrganization} from 'sentry/utils/useOrganization';
import {detectorListApiOptions} from 'sentry/views/detectors/hooks';
import {parseAsScalar} from 'sentry/views/explore/queryParams/parsers';

import {DETECTOR_LIST_PAGE_LIMIT} from './constants';
import {useDetectorListSort} from './useDetectorListSort';

type UseDetectorListQueryOptions = {
  assigneeFilter?: string;
  detectorFilter?: Exclude<DetectorType, 'issue_stream'>;
};

export function useDetectorListQuery({
  detectorFilter,
  assigneeFilter,
}: UseDetectorListQueryOptions = {}) {
  const {selection, isReady} = usePageFilters();
  const [{cursor, query}] = useQueryStates({cursor: parseAsScalar, query: parseAsScalar});
  const [sort] = useDetectorListSort();
  const organization = useOrganization();

  // Build the query with detector type and assignee filters if provided
  // Map DetectorType values to query values (e.g., 'monitor_check_in_failure' -> 'cron')
  const typeFilterQuery = detectorFilter ? `type:${detectorFilter}` : undefined;
  const assigneeFilterQuery = assigneeFilter ? `assignee:${assigneeFilter}` : undefined;
  const finalQuery = [typeFilterQuery, assigneeFilterQuery, query]
    .filter(Boolean)
    .join(' ');

  return useQuery({
    ...detectorListApiOptions(organization, {
      cursor: cursor ?? undefined,
      query: finalQuery,
      sortBy: sort ? `${sort.kind === 'asc' ? '' : '-'}${sort.field}` : undefined,
      projects: selection.projects,
      limit: DETECTOR_LIST_PAGE_LIMIT,
    }),
    select: selectJsonWithHeaders,
    enabled: isReady,
  });
}
