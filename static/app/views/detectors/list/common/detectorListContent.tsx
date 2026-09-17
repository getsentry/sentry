import {useCallback, type ReactNode} from 'react';

import {Pagination, useGetPaginationCaption} from '@sentry/scraps/pagination';

import type {Detector} from 'sentry/types/workflowEngine/detectors';
import type {ApiResponse} from 'sentry/utils/api/apiFetch';
import {parseLinkHeader} from 'sentry/utils/parseLinkHeader';
import {VisuallyCompleteWithData} from 'sentry/utils/performanceForSentry';
import {decodeScalar} from 'sentry/utils/queryString';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import {useProjects} from 'sentry/utils/useProjects';
import {DetectorListTable} from 'sentry/views/detectors/components/detectorListTable';
import {DETECTOR_LIST_PAGE_LIMIT} from 'sentry/views/detectors/list/common/constants';
import {useDetectorListSort} from 'sentry/views/detectors/list/common/useDetectorListSort';
import {
  LLM_CONTEXT_MAX_ROWS,
  useLLMContext,
} from 'sentry/views/seerExplorer/contexts/llmContext';
import {registerLLMContext} from 'sentry/views/seerExplorer/contexts/registerLLMContext';
import {
  toLLMContextProjectFields,
  useSelectedProjectsForLLMContext,
} from 'sentry/views/seerExplorer/utils/selectedProjectsForLLMContext';

interface DetectorListContentProps {
  data: ApiResponse<Detector[]> | undefined;
  isError: boolean;
  isLoading: boolean;
  isSuccess: boolean;
  emptyState?: ReactNode;
}

/**
 * Report the visible monitors as a pipe-delimited CSV, capped at
 * `LLM_CONTEXT_MAX_ROWS`. Matches the shape the issue list already sends, and
 * costs a fraction of the tokens the equivalent array of objects would.
 */
function formatDetectorRows(
  detectors: Detector[],
  projectSlugById: Map<string, string>
): string {
  return [
    'id|name|type|enabled|project',
    ...detectors
      .slice(0, LLM_CONTEXT_MAX_ROWS)
      .map(detector =>
        [
          detector.id,
          detector.name.replace(/[|\n]/g, ' '),
          detector.type,
          detector.enabled,
          detector.projectId
            ? (projectSlugById.get(detector.projectId) ?? detector.projectId)
            : '',
        ].join('|')
      ),
  ].join('\n');
}

function DetectorListContentInner({
  data,
  emptyState,
  isLoading,
  isError,
  isSuccess,
}: DetectorListContentProps) {
  const getPaginationCaption = useGetPaginationCaption();
  const location = useLocation();
  const navigate = useNavigate();

  const hits = data?.headers['X-Hits'] ?? 0;
  // If maxHits is not set, we assume there is no max
  const maxHits = data?.headers['X-Max-Hits'] ?? Infinity;
  const pageLinks = data?.headers.Link;

  const cursor = decodeScalar(location.query.cursor);
  const query = decodeScalar(location.query.query) ?? '';

  const allResultsVisible = useCallback(() => {
    if (!pageLinks) {
      return false;
    }
    const links = parseLinkHeader(pageLinks);
    return links && !links.previous!.results && !links.next!.results;
  }, [pageLinks]);

  const paginationCaption =
    isLoading || !data?.json
      ? undefined
      : getPaginationCaption({
          cursor,
          limit: DETECTOR_LIST_PAGE_LIMIT,
          pageLength: data.json.length,
          total: hits,
        });

  const {projects} = useProjects();
  const selectedProjects = useSelectedProjectsForLLMContext();
  // Read the effective sort, not `location.query.sort` — the list falls back to
  // `-latestGroup` when the URL carries no sort, and reporting that as empty
  // would tell Seer the list is unsorted.
  const [sort] = useDetectorListSort();

  useLLMContext({
    contextHint:
      'Sentry monitors list page. Monitors watch errors, metrics, cron check-ins, uptime checks, ' +
      'and mobile build sizes, and open issues when they fire. ' +
      'query is only what the user typed in the search box. Every route except /monitors/ adds a ' +
      'filter of its own that appears in neither the search box nor the URL — the per-type routes ' +
      'pin that monitor type, and /monitors/my-monitors/ pins assignment to the viewer and their ' +
      'teams — so an empty query does not mean an unfiltered list. Read location.name for which ' +
      'route is in view. ' +
      `displayedMonitors is a pipe-delimited CSV with a header row of the visible monitors, capped at ${LLM_CONTEXT_MAX_ROWS} rows. ` +
      'monitorCount is the total number of matching monitors — there may be many more than are displayed, ' +
      'so look a monitor up by id rather than assuming the sample is complete. ' +
      'projectSelectionInstruction describes the page-filter project scope (explicit pins vs My/All Projects). ' +
      'When projectIds/projectSlugs are empty, that is expected for My/All Projects — follow projectSelectionInstruction.',
    query,
    sort: sort ? `${sort.kind === 'asc' ? '' : '-'}${sort.field}` : '',
    monitorCount: hits,
    cursor,
    isLoading,
    ...toLLMContextProjectFields(selectedProjects),
    displayedMonitors: formatDetectorRows(
      data?.json ?? [],
      new Map(projects.map(project => [project.id, project.slug]))
    ),
  });

  return (
    <div>
      <VisuallyCompleteWithData
        hasData={(data?.json.length ?? 0) > 0}
        id="MonitorsList-Table"
        isLoading={isLoading}
      >
        {isSuccess && data?.json.length === 0 && emptyState ? (
          emptyState
        ) : (
          <DetectorListTable
            detectors={data?.json ?? []}
            isPending={isLoading}
            isError={isError}
            isSuccess={isSuccess}
            queryCount={hits > maxHits ? `${maxHits}+` : `${hits}`}
            allResultsVisible={allResultsVisible()}
          />
        )}
      </VisuallyCompleteWithData>
      <Pagination
        pageLinks={pageLinks}
        caption={paginationCaption}
        onCursor={newCursor => {
          navigate({
            pathname: location.pathname,
            query: {...location.query, cursor: newCursor},
          });
        }}
      />
    </div>
  );
}

export const DetectorListContent = registerLLMContext(
  'monitor-list',
  DetectorListContentInner
);
