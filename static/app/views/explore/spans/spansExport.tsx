import {Button} from 'sentry/components/core/button';
import DataExport, {ExportQueryType} from 'sentry/components/dataExport';
import {IconOpen} from 'sentry/icons/iconOpen';
import {t} from 'sentry/locale';
import type EventView from 'sentry/utils/discover/eventView';
import type {QueryError} from 'sentry/utils/discover/genericDiscoverQuery';
import {useLocation} from 'sentry/utils/useLocation';
import {downloadAsCsv} from 'sentry/views/discover/utils';
import {Mode} from 'sentry/views/explore/contexts/pageParamsContext/mode';
import type {AggregatesTableResult} from 'sentry/views/explore/hooks/useExploreAggregatesTable';
import type {SpansTableResult} from 'sentry/views/explore/hooks/useExploreSpansTable';
import {Tab, useTab} from 'sentry/views/explore/hooks/useTab';

type ExploreExportProps = {
  aggregatesTableResult: AggregatesTableResult;
  spansTableResult: SpansTableResult;
};

const PAGINATION_LIMIT = 50;

export function ExploreExport({
  aggregatesTableResult,
  spansTableResult,
}: ExploreExportProps) {
  const location = useLocation();
  const [tab, _setTab] = useTab();

  let eventView: EventView | null = null;
  let results = null;
  let isPending = false;
  let error: QueryError | null = null;
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

  // TODO(nikki): track analytics

  if (data.length < PAGINATION_LIMIT) {
    return (
      <Button
        size="xs"
        disabled={disabled}
        onClick={() =>
          downloadAsCsv(results, eventView?.getColumns(), ExportQueryType.EXPLORE)
        }
        icon={<IconOpen />}
        title={
          disabled
            ? undefined
            : t(
                "There aren't that many results, start your export and it'll download immediately."
              )
        }
      >
        {t('Export')}
      </Button>
    );
  }

  return (
    <DataExport
      size="xs"
      payload={{
        queryType: ExportQueryType.EXPLORE,
        queryInfo: eventView?.getEventsAPIPayload(location),
      }}
      disabled={disabled}
      icon={<IconOpen />}
    >
      {t('Export')}
    </DataExport>
  );
}
