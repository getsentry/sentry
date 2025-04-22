import EventView from 'sentry/utils/discover/eventView';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {useLocation} from 'sentry/utils/useLocation';
import usePageFilters from 'sentry/utils/usePageFilters';
import useProjects from 'sentry/utils/useProjects';
import {useServiceEntrySpansQuery} from 'sentry/views/performance/otlp/useServiceEntrySpansQuery';
import {getOTelTransactionsListSort} from 'sentry/views/performance/otlp/utils';

const LIMIT = 50;

type Props = {
  eventView: EventView;
  handleDropdownChange: (k: string) => void;
  totalValues: Record<string, number> | null;
  transactionName: string;
  showViewSampledEventsButton?: boolean;
  supportsInvestigationRule?: boolean;
};

export function OverviewSpansTable({
  eventView,
  handleDropdownChange,
  totalValues,
  transactionName,
  showViewSampledEventsButton,
  supportsInvestigationRule,
}: Props) {
  const {selection} = usePageFilters();
  const location = useLocation();
  const projects = useProjects();
  const projectSlug = projects.find(p => p.id === `${eventView.project}`)?.slug;
  const cursor = decodeScalar(location.query?.[CURSOR_NAME]);
  const spanCategory = decodeScalar(location.query?.[SpanIndexedField.SPAN_CATEGORY]);

  const {selected, options} = getOTelTransactionsListSort(location, spanCategory);

  const p95 = totalValues?.['p95()'] ?? 0;
  const query = new MutableSearch('');

  const {
    data: tableData,
    isLoading,
    pageLinks,
    meta,
    error,
  } = useServiceEntrySpansQuery({
    query: query.formatString(),
    sort: selected.sort,
    transactionName,
    p95,
    selected,
    limit: LIMIT,
  });

  // <Pagination
  //         pageLinks={pageLinks}
  //         onCursor={handleCursor}
  //         size="md"
  //         caption={numEventsError ? undefined : paginationCaption}
  //       />
}
