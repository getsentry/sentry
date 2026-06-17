import {downloadAsJsonl} from 'sentry/components/exports/downloadAsJsonl';
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

  let eventView = null;
  let isPending = false;
  let error = null;
  let data: Array<Record<string, unknown>> = [];

  switch (tab) {
    case Tab.SPAN:
      eventView = spansTableResult.eventView;
      isPending = spansTableResult.result.isPending;
      error = spansTableResult.result.error;
      data = spansTableResult.result.data ?? [];
      break;
    case Mode.AGGREGATE:
      eventView = aggregatesTableResult.eventView;
      isPending = aggregatesTableResult.result.isPending;
      error = aggregatesTableResult.result.error;
      data = aggregatesTableResult.result.data ?? [];
      break;
    default:
      break;
  }

  const estimatedRowCount =
    tab === Tab.SPAN
      ? Math.max(data.length, rawSpanCounts.total.count ?? 0)
      : data.length;

  const queryInfo: Record<string, any> = eventView
    ? eventView.getEventsAPIPayload(location)
    : {};

  const config: ExploreExportConfig = {
    title: t('Traces Export'),
    filenameBase: 'Traces',
    queryInfo: {...queryInfo, dataset: TraceItemDataset.SPANS},
    asyncQueryType: ExportQueryType.EXPLORE,
    supportsAllColumns: false,
    availableFormats: ['csv', 'jsonl'],
    estimatedRowCount,
    localDownload: ({format, limit}) => {
      const rows = data.slice(0, limit);
      if (format === 'jsonl') {
        downloadAsJsonl(rows, 'Traces');
      } else {
        downloadAsCsv({data: rows}, eventView?.getColumns() ?? [], 'Traces');
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
      isDataEmpty={data.length === 0}
      isDataError={error !== null}
      isDataLoading={isPending}
    />
  );
}
