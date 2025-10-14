import type {Sort} from 'sentry/utils/discover/fields';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {STARRED_SEGMENT_TABLE_QUERY_KEY} from 'sentry/views/insights/common/components/tableCells/starredSegmentCell';
import {useSpans} from 'sentry/views/insights/common/queries/useDiscover';
import {
  type Row,
  type ValidSort,
} from 'sentry/views/insights/pages/frontend/frontendOverviewTable';
import type {PageSpanOps} from 'sentry/views/insights/pages/frontend/settings';

export const useFrontendTableData = (
  search: MutableSearch,
  sorts: [ValidSort, ValidSort],
  displayPerfScore: boolean,
  spanOpFilter?: PageSpanOps,
  cursor?: string
) => {
  let transactionFilter: `${string},equals,${string}` = 'is_transaction,equals,true';
  if (spanOpFilter === 'pageload') {
    transactionFilter = 'span.op,equals,pageload';
  } else if (spanOpFilter === 'navigation') {
    transactionFilter = 'span.op,equals,navigation';
  }

  const newSorts: Sort[] = sorts.map(sort => ({
    ...sort,
    field: sort.field.replace('is_transaction,equals,true', transactionFilter),
  }));

  const response = useSpans(
    {
      search,
      sorts: newSorts,
      cursor,
      useQueryOptions: {additonalQueryKey: STARRED_SEGMENT_TABLE_QUERY_KEY},
      fields: [
        'is_starred_transaction',
        'transaction',
        'project',
        'tpm()', // TODO: replace with `tpm_if`
        `p50_if(span.duration,${transactionFilter})`,
        `p75_if(span.duration,${transactionFilter})`,
        `p95_if(span.duration,${transactionFilter})`,
        `failure_rate_if(${transactionFilter})`,
        ...(displayPerfScore
          ? (['performance_score(measurements.score.total)'] as const)
          : []),
        'count_unique(user)',
        `sum_if(span.duration,${transactionFilter})`,
      ],
    },
    'api.insights.frontend.landing-table'
  );

  const newData: Row[] = response.data.map(row => {
    return {
      ...row,
      'p50_if(span.duration,is_transaction,equals,true)':
        row[`p50_if(span.duration,${transactionFilter})`] ?? 0,
      'p75_if(span.duration,is_transaction,equals,true)':
        row[`p75_if(span.duration,${transactionFilter})`] ?? 0,
      'p95_if(span.duration,is_transaction,equals,true)':
        row[`p95_if(span.duration,${transactionFilter})`] ?? 0,
      'failure_rate_if(is_transaction,equals,true)':
        row[`failure_rate_if(${transactionFilter})`] ?? 0,
      'sum_if(span.duration,is_transaction,equals,true)':
        row[`sum_if(span.duration,${transactionFilter})`] ?? 0,
    };
  });

  const updateMetaIfExists = (oldField: string, newField: string) => {
    if (response?.meta?.fields?.[oldField]) {
      response.meta.fields[newField] = response?.meta?.fields[oldField];
    }
  };

  updateMetaIfExists(
    `p50_if(span.duration,${transactionFilter})`,
    'p50_if(span.duration,is_transaction,equals,true)'
  );
  updateMetaIfExists(
    `p75_if(span.duration,${transactionFilter})`,
    'p75_if(span.duration,is_transaction,equals,true)'
  );
  updateMetaIfExists(
    `p95_if(span.duration,${transactionFilter})`,
    'p95_if(span.duration,is_transaction,equals,true)'
  );
  updateMetaIfExists(
    `failure_rate_if(${transactionFilter})`,
    'failure_rate_if(is_transaction,equals,true)'
  );
  updateMetaIfExists(
    `sum_if(span.duration,${transactionFilter})`,
    'sum_if(span.duration,is_transaction,equals,true)'
  );

  return {...response, data: newData};
};
