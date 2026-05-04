import {useCallback, type ReactNode} from 'react';

import {getPaginationCaption, Pagination} from '@sentry/scraps/pagination';

import type {Detector} from 'sentry/types/workflowEngine/detectors';
import type {ApiResponse} from 'sentry/utils/api/apiFetch';
import {parseLinkHeader} from 'sentry/utils/parseLinkHeader';
import {VisuallyCompleteWithData} from 'sentry/utils/performanceForSentry';
import {decodeScalar} from 'sentry/utils/queryString';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import {DetectorListTable} from 'sentry/views/detectors/components/detectorListTable';
import {DETECTOR_LIST_PAGE_LIMIT} from 'sentry/views/detectors/list/common/constants';

interface DetectorListContentProps {
  data: ApiResponse<Detector[]> | undefined;
  isError: boolean;
  isLoading: boolean;
  isSuccess: boolean;
  emptyState?: ReactNode;
}

export function DetectorListContent({
  data,
  emptyState,
  isLoading,
  isError,
  isSuccess,
}: DetectorListContentProps) {
  const location = useLocation();
  const navigate = useNavigate();

  const hits = data?.headers['X-Hits'] ?? 0;
  // If maxHits is not set, we assume there is no max
  const maxHits = data?.headers['X-Max-Hits'] ?? Infinity;
  const pageLinks = data?.headers.Link;

  const cursor = decodeScalar(location.query.cursor);

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
