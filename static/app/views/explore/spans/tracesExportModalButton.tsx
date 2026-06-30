import {downloadAsJsonl} from 'sentry/components/exports/downloadAsJsonl';
import {ROW_COUNT_VALUE_MAX} from 'sentry/components/exports/generateExportRowCountOptions';
import {ExportQueryType} from 'sentry/components/exports/useDataExport';
import {t} from 'sentry/locale';
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
import {SPANS_TABLE_LIMIT} from 'sentry/views/explore/spans/constants';
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

  const estimatedRowCount =
    tab === Tab.SPAN
      ? Math.max(data.length, rawSpanCounts.total.count ?? 0)
      : data.length >= SPANS_TABLE_LIMIT
        ? Math.max(data.length, ROW_COUNT_VALUE_MAX)
        : data.length;

  const queryInfo: Record<string, any> = eventView.getEventsAPIPayload(location);

  const config: ExploreExportConfig = {
    title: t('Traces Export'),
    filenameBase: 'Traces',
    queryInfo: {...queryInfo, dataset: TraceItemDataset.SPANS},
    asyncQueryType: ExportQueryType.EXPLORE,
    supportsAllColumns: false,
    availableFormats: ['csv', 'jsonl'],
    estimatedRowCount,
    localRowCount: data.length,
    localDownload: ({format, limit}) => {
      const rows = data.slice(0, limit);
      if (format === 'jsonl') {
        downloadAsJsonl(rows, 'Traces');
      } else {
        downloadAsCsv({data: rows}, eventView.getColumns(), 'Traces');
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
