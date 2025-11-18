import {useLocation} from 'sentry/utils/useLocation';
import {downloadAsCsv} from 'sentry/views/discover/utils';
import {ExploreExport} from 'sentry/views/explore/components/exploreExport';
import {Mode} from 'sentry/views/explore/contexts/pageParamsContext/mode';
import type {AggregatesTableResult} from 'sentry/views/explore/hooks/useExploreAggregatesTable';
import type {SpansTableResult} from 'sentry/views/explore/hooks/useExploreSpansTable';
import {Tab, useTab} from 'sentry/views/explore/hooks/useTab';
import {TraceItemDataset} from 'sentry/views/explore/types';

type SpansExportProps = {
  aggregatesTableResult: AggregatesTableResult;
  spansTableResult: SpansTableResult;
};

const PAGINATION_LIMIT = 50;

export function SpansExport({aggregatesTableResult, spansTableResult}: SpansExportProps) {
  const [tab] = useTab();
  const location = useLocation();

  let eventView = null;
  let results = null;
  let isPending = false;
  let error = null;
  let data = [];

  switch (tab) {
    case Tab.SPAN:
      eventView = spansTableResult.eventView;
      isPending = spansTableResult.result.isPending;
      error = spansTableResult.result.error;
      data = spansTableResult.result.data ?? [];
      results = spansTableResult.result;
      break;
    case Mode.AGGREGATE:
      eventView = aggregatesTableResult.eventView;
      isPending = aggregatesTableResult.result.isPending;
      error = aggregatesTableResult.result.error;
      data = aggregatesTableResult.result.data ?? [];
      results = aggregatesTableResult.result;
      break;
    default:
      eventView = null;
      isPending = false;
      error = null;
      data = [];
      results = null;
      break;
  }

  const disabled =
    isPending ||
    error !== null ||
    tab === Tab.TRACE ||
    results === null ||
    eventView === null;

  const hasReachedCSVLimit = data.length >= PAGINATION_LIMIT;
  const isDataEmpty = !data || data.length === 0;
  const isDataLoading = isPending;
  const isDataError = error !== null;

  const handleDownloadAsCsv = () => {
    if (results && eventView) {
      downloadAsCsv(results, eventView.getColumns(), 'Traces');
    }
  };

  const queryInfo = eventView?.getEventsAPIPayload(location);

  return (
    <ExploreExport
      traceItemDataset={TraceItemDataset.SPANS}
      disabled={disabled}
      hasReachedCSVLimit={hasReachedCSVLimit}
      queryInfo={queryInfo}
      isDataEmpty={isDataEmpty}
      isDataLoading={isDataLoading}
      isDataError={isDataError}
      downloadAsCsv={handleDownloadAsCsv}
    />
  );
}
