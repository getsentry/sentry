import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {useEAPSpans} from 'sentry/views/insights/common/queries/useDiscover';
import {SpanIndexedField} from 'sentry/views/insights/types';

type Props = {
  search: string;
  serviceEntrySpanName: string;
};

const LIMIT = 10;

export function SpanCategoryFilter({search, serviceEntrySpanName}: Props) {
  const searchQuery = new MutableSearch(search);
  // TODO: this will change to span.name eventually
  searchQuery.addFilterValue('span.description', serviceEntrySpanName);

  const {data, isPending, error} = useEAPSpans(
    {
      limit: LIMIT,
      fields: [SpanIndexedField.SPAN_CATEGORY, 'count()'],
      search: searchQuery,
      sorts: [{field: 'count()', kind: 'desc'}],
    },
    'api.transaction-summary.span-category-filter'
  );

  console.dir(data);

  return <div>SpanCategoryFilter</div>;
}
