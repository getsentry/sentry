import {Fragment, useMemo} from 'react';

import Pagination from 'sentry/components/pagination';
import type {NewQuery} from 'sentry/types/organization';
import EventView from 'sentry/utils/discover/eventView';
import {getFieldRenderer} from 'sentry/utils/discover/fieldRenderers';
import {getAggregateAlias, type Sort} from 'sentry/utils/discover/fields';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import {
  Table,
  TableBody,
  TableBodyCell,
  TableHead,
  TableHeadCell,
  TableRow,
  useTableStyles,
} from 'sentry/views/explore/components/table';
import {useDataset} from 'sentry/views/explore/hooks/useDataset';
import {useGroupBys} from 'sentry/views/explore/hooks/useGroupBys';
import {useSorts} from 'sentry/views/explore/hooks/useSorts';
import {useUserQuery} from 'sentry/views/explore/hooks/useUserQuery';
import {useVisualizes} from 'sentry/views/explore/hooks/useVisualizes';
import {useSpansQuery} from 'sentry/views/insights/common/queries/useSpansQuery';

function formatSort(sort: Sort): string {
  const direction = sort.kind === 'desc' ? '-' : '';
  return `${direction}${getAggregateAlias(sort.field)}`;
}

interface AggregatesTableProps {}

export function AggregatesTable({}: AggregatesTableProps) {
  const location = useLocation();
  const organization = useOrganization();
  const {selection} = usePageFilters();

  const [dataset] = useDataset();
  const [groupBys] = useGroupBys();
  const [visualizes] = useVisualizes();
  const fields = useMemo(() => {
    return [...groupBys, ...visualizes.flatMap(visualize => visualize.yAxes)].filter(
      Boolean
    );
  }, [groupBys, visualizes]);
  const [sorts] = useSorts({fields});
  const [query] = useUserQuery();

  const eventView = useMemo(() => {
    const discoverQuery: NewQuery = {
      id: undefined,
      name: 'Explore - Span Aggregates',
      fields,
      orderby: sorts.map(formatSort),
      query,
      version: 2,
      dataset,
    };

    return EventView.fromNewQueryWithPageFilters(discoverQuery, selection);
  }, [dataset, fields, sorts, query, selection]);

  const result = useSpansQuery({
    eventView,
    initialData: [],
    referrer: 'api.explore.spans-aggregates-table',
  });

  const {tableStyles} = useTableStyles({
    items: fields.map(field => {
      return {
        label: field,
        value: field,
      };
    }),
  });

  const meta = result.meta ?? {};

  return (
    <Fragment>
      <Table style={tableStyles}>
        <TableHead>
          <TableRow>
            {fields.map((field, i) => (
              <TableHeadCell key={i} isFirst={i === 0}>
                {field}
              </TableHeadCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {result.data?.map((row, i) => (
            <TableRow key={i}>
              {fields.map((field, j) => {
                const renderer = getFieldRenderer(field, meta.fields, false);
                return (
                  <TableBodyCell key={j}>
                    {renderer(row, {
                      location,
                      organization,
                      unit: meta?.units?.[field],
                    })}
                  </TableBodyCell>
                );
              })}
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <Pagination pageLinks={result.pageLinks} />
    </Fragment>
  );
}
