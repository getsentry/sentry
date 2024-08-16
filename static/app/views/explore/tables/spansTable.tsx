import {Fragment, useMemo} from 'react';

import Pagination from 'sentry/components/pagination';
import type {NewQuery} from 'sentry/types/organization';
import EventView from 'sentry/utils/discover/eventView';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import usePageFilters from 'sentry/utils/usePageFilters';
import {useSampleFields} from 'sentry/views/explore/hooks/useSampleFields';
import {useSorts} from 'sentry/views/explore/hooks/useSorts';
import {useUserQuery} from 'sentry/views/explore/hooks/useUserQuery';
import {useSpansQuery} from 'sentry/views/insights/common/queries/useSpansQuery';

interface SpansTableProps {}

export function SpansTable({}: SpansTableProps) {
  const {selection} = usePageFilters();

  const [fields] = useSampleFields();
  const [sorts] = useSorts({fields});
  const [query] = useUserQuery();

  const eventView = useMemo(() => {
    const discoverQuery: NewQuery = {
      id: undefined,
      name: 'Explore - Span Samples',
      fields,
      orderby: sorts.map(sort => `${sort.kind === 'desc' ? '-' : ''}${sort.field}`),
      query,
      version: 2,
      dataset: DiscoverDatasets.SPANS_INDEXED,
    };

    return EventView.fromNewQueryWithPageFilters(discoverQuery, selection);
  }, [fields, sorts, query, selection]);

  const result = useSpansQuery({
    eventView,
    initialData: [],
    referrer: 'api.explore.spans-samples-table',
  });

  return (
    <Fragment>
      {/* TODO: make this prettier */}
      <table>
        <tr>
          {fields.map(field => (
            <th key={field}>{field}</th>
          ))}
        </tr>
        {result.data?.map((row, i) => (
          <tr key={i}>
            {fields.map(field => (
              <th key={field}>{row[field]}</th>
            ))}
          </tr>
        ))}
      </table>
      <Pagination pageLinks={result.pageLinks} />
    </Fragment>
  );
}
