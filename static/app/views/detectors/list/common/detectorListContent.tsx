import {useCallback, type ReactNode} from 'react';

import Pagination from 'sentry/components/pagination';
import type {Detector} from 'sentry/types/workflowEngine/detectors';
import parseLinkHeader from 'sentry/utils/parseLinkHeader';
import {VisuallyCompleteWithData} from 'sentry/utils/performanceForSentry';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import DetectorListTable from 'sentry/views/detectors/components/detectorListTable';

interface DetectorListContentProps {
  data: Detector[] | undefined;
  isError: boolean;
  isLoading: boolean;
  isSuccess: boolean;
  emptyState?: ReactNode;
  getResponseHeader?: ((header: string) => string | null | undefined) | undefined;
}

export function DetectorListContent({
  data,
  emptyState,
  isLoading,
  isError,
  isSuccess,
  getResponseHeader,
}: DetectorListContentProps) {
  const location = useLocation();
  const navigate = useNavigate();

  const hits = getResponseHeader?.('X-Hits') || '';
  const hitsInt = hits ? parseInt(hits, 10) || 0 : 0;
  // If maxHits is not set, we assume there is no max
  const maxHits = getResponseHeader?.('X-Max-Hits') || '';
  const maxHitsInt = maxHits ? parseInt(maxHits, 10) || Infinity : Infinity;

  const pageLinks = getResponseHeader?.('Link');

  const allResultsVisible = useCallback(() => {
    if (!pageLinks) {
      return false;
    }
    const links = parseLinkHeader(pageLinks);
    return links && !links.previous!.results && !links.next!.results;
  }, [pageLinks]);

  return (
    <div>
      <VisuallyCompleteWithData
        hasData={(data?.length ?? 0) > 0}
        id="MonitorsList-Table"
        isLoading={isLoading}
      >
        {isSuccess && data?.length === 0 && emptyState ? (
          emptyState
        ) : (
          <DetectorListTable
            detectors={data ?? []}
            isPending={isLoading}
            isError={isError}
            isSuccess={isSuccess}
            queryCount={hitsInt > maxHitsInt ? `${maxHits}+` : hits}
            allResultsVisible={allResultsVisible()}
          />
        )}
      </VisuallyCompleteWithData>
      <Pagination
        pageLinks={pageLinks}
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
