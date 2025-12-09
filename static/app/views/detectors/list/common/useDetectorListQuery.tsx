import type {DetectorType} from 'sentry/types/workflowEngine/detectors';
import {decodeScalar} from 'sentry/utils/queryString';
import {useLocation} from 'sentry/utils/useLocation';
import usePageFilters from 'sentry/utils/usePageFilters';
import {useDetectorsQuery} from 'sentry/views/detectors/hooks';
import {DETECTOR_LIST_PAGE_LIMIT} from 'sentry/views/detectors/list/common/constants';
import {useDetectorListSort} from 'sentry/views/detectors/list/common/useDetectorListSort';

type UseDetectorListQueryOptions = {
  assigneeFilter?: string;
  detectorFilter?: Exclude<DetectorType, 'issue_stream'>;
};

export function useDetectorListQuery({
  detectorFilter,
  assigneeFilter,
}: UseDetectorListQueryOptions = {}) {
  const location = useLocation();
  const {selection, isReady} = usePageFilters();
  const cursor = decodeScalar(location.query.cursor);
  const query = decodeScalar(location.query.query);
  const [sort] = useDetectorListSort();

  // Build the query with detector type and assignee filters if provided
  // Map DetectorType values to query values (e.g., 'monitor_check_in_failure' -> 'cron')
  const typeFilterQuery = detectorFilter ? `type:${detectorFilter}` : undefined;
  const assigneeFilterQuery = assigneeFilter ? `assignee:${assigneeFilter}` : undefined;
  const finalQuery = [typeFilterQuery, assigneeFilterQuery, query]
    .filter(Boolean)
    .join(' ');

  return useDetectorsQuery(
    {
      cursor,
      query: finalQuery,
      sortBy: sort ? `${sort.kind === 'asc' ? '' : '-'}${sort.field}` : undefined,
      projects: selection.projects,
      limit: DETECTOR_LIST_PAGE_LIMIT,
    },
    {enabled: isReady}
  );
}
