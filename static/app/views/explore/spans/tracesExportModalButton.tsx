import {downloadAsJsonl} from 'sentry/components/exports/downloadAsJsonl';
import {ROW_COUNT_VALUE_MAX} from 'sentry/components/exports/generateExportRowCountOptions';
import {
  type ExploreQueryInfo,
  ExportQueryType,
} from 'sentry/components/exports/useDataExport';
import {t} from 'sentry/locale';
import {parseLinkHeader} from 'sentry/utils/parseLinkHeader';
import {decodeList, decodeScalar} from 'sentry/utils/queryString';
import {useLocation} from 'sentry/utils/useLocation';
import {useOrganization} from 'sentry/utils/useOrganization';
import {downloadAsCsv} from 'sentry/views/discover/utils';
import {ExploreExportModalButton} from 'sentry/views/explore/components/exports/exploreExportModalButton';
import {trackExploreTableExported} from 'sentry/views/explore/components/exports/trackExploreTableExported';
import type {ExploreExportConfig} from 'sentry/views/explore/components/exports/types';
import {Mode} from 'sentry/views/explore/contexts/pageParamsContext/mode';
import type {AggregatesTableResult} from 'sentry/views/explore/hooks/useExploreAggregatesTable';
import type {SpansTableResult} from 'sentry/views/explore/hooks/useExploreSpansTable';
import {Tab, useTab} from 'sentry/views/explore/hooks/useTab';
import {TraceItemDataset} from 'sentry/views/explore/types';
import type {RawCounts} from 'sentry/views/explore/useRawCounts';

type TracesExportModalButtonProps = {
  aggregatesTableResult: AggregatesTableResult;
  rawSpanCounts: RawCounts;
  spansTableResult: SpansTableResult;
};

export function TracesExportModalButton({
  aggregatesTableResult,
  rawSpanCounts,
  spansTableResult,
}: TracesExportModalButtonProps) {
  const [tab] = useTab();
  const location = useLocation();
  const organization = useOrganization();

  // Export only applies to the Span and Aggregate tables; the Trace and
  // Attribute Breakdowns tabs render unrelated data, so export is disabled there.
  const isExportSupported = tab === Tab.SPAN || tab === Mode.AGGREGATE;

  const targetTableResult = tab === Tab.SPAN ? spansTableResult : aggregatesTableResult;
  const {eventView} = targetTableResult;
  const data = targetTableResult.result.data ?? [];

  const hasMoreRows =
    parseLinkHeader(targetTableResult.result.pageLinks ?? null)?.next?.results ?? false;

  // The Span count comes from a separate query; while it's loading or after it
  // errors the count is null, so fall back to the max option rather than
  // collapsing the estimate to the loaded page and hiding the server export.
  const spanTotalCount = rawSpanCounts.total.count;
  const estimatedRowCount =
    tab === Tab.SPAN
      ? spanTotalCount === null
        ? Math.max(data.length, ROW_COUNT_VALUE_MAX)
        : Math.max(data.length, spanTotalCount)
      : hasMoreRows
        ? Math.max(data.length, ROW_COUNT_VALUE_MAX)
        : data.length;

  const payload = eventView.getEventsAPIPayload(location);
  const queryInfo: ExploreQueryInfo = {
    dataset: TraceItemDataset.SPANS,
    field: payload.field,
    project: decodeList(payload.project).map(Number),
    query: payload.query,
    sort: decodeList(payload.sort),
    environment: payload.environment,
    start: decodeScalar(payload.start),
    end: decodeScalar(payload.end),
    statsPeriod: decodeScalar(payload.statsPeriod),
  };

  const filenameBase = 'Traces';

  const config: ExploreExportConfig = {
    title: t('Traces Export'),
    filenameBase,
    queryInfo,
    asyncQueryType: ExportQueryType.EXPLORE,
    supportsAllColumns: false,
    availableFormats: ['csv', 'jsonl'],
    estimatedRowCount,
    localRowCount: data.length,
    localDownload: ({format, limit}) => {
      const rows = data.slice(0, limit);
      if (format === 'jsonl') {
        downloadAsJsonl(rows, filenameBase);
      } else {
        downloadAsCsv({data: rows}, eventView.getColumns(), filenameBase);
      }
    },
    trackExportSubmit: args =>
      trackExploreTableExported({
        ...args,
        organization,
        traceItemDataset: TraceItemDataset.SPANS,
        queryInfo,
      }),
  };

  return (
    <ExploreExportModalButton
      config={config}
      disabled={!isExportSupported}
      isDataEmpty={isExportSupported && data.length === 0}
      isDataError={isExportSupported && targetTableResult.result.error !== null}
      isDataLoading={isExportSupported && targetTableResult.result.isPending}
    />
  );
}
