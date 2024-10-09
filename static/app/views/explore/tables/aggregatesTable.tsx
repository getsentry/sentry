import {Fragment, useMemo} from 'react';
import styled from '@emotion/styled';

import EmptyStateWarning from 'sentry/components/emptyStateWarning';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import Pagination from 'sentry/components/pagination';
import {CHART_PALETTE} from 'sentry/constants/chartPalette';
import {IconWarning} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {NewQuery} from 'sentry/types/organization';
import EventView from 'sentry/utils/discover/eventView';
import {fieldAlignment, getAggregateAlias, type Sort} from 'sentry/utils/discover/fields';
import usePageFilters from 'sentry/utils/usePageFilters';
import {
  Table,
  TableBody,
  TableBodyCell,
  TableHead,
  TableHeadCell,
  TableRow,
  TableStatus,
  useTableStyles,
} from 'sentry/views/explore/components/table';
import {useDataset} from 'sentry/views/explore/hooks/useDataset';
import {useGroupBys} from 'sentry/views/explore/hooks/useGroupBys';
import {useSorts} from 'sentry/views/explore/hooks/useSorts';
import {useUserQuery} from 'sentry/views/explore/hooks/useUserQuery';
import {useVisualizes} from 'sentry/views/explore/hooks/useVisualizes';
import {useSpansQuery} from 'sentry/views/insights/common/queries/useSpansQuery';

import {TOP_EVENTS_LIMIT, useTopEvents} from '../hooks/useTopEvents';

import {FieldRenderer} from './fieldRenderer';

export function formatSort(sort: Sort): string {
  const direction = sort.kind === 'desc' ? '-' : '';
  return `${direction}${getAggregateAlias(sort.field)}`;
}

interface AggregatesTableProps {}

export function AggregatesTable({}: AggregatesTableProps) {
  const {selection} = usePageFilters();
  const topEvents = useTopEvents();
  const [dataset] = useDataset();
  const {groupBys} = useGroupBys();
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

  const columns = useMemo(() => eventView.getColumns(), [eventView]);

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
            {fields.map((field, i) => {
              // Hide column names before alignment is determined
              if (result.isPending) {
                return <TableHeadCell key={i} isFirst={i === 0} />;
              }

              const fieldType = meta.fields?.[field];
              const align = fieldAlignment(field, fieldType);
              return (
                <TableHeadCell align={align} key={i} isFirst={i === 0}>
                  <span>{field}</span>
                </TableHeadCell>
              );
            })}
          </TableRow>
        </TableHead>
        <TableBody>
          {result.isPending ? (
            <TableStatus>
              <LoadingIndicator />
            </TableStatus>
          ) : result.isError ? (
            <TableStatus>
              <IconWarning data-test-id="error-indicator" color="gray300" size="lg" />
            </TableStatus>
          ) : result.isFetched && result.data?.length ? (
            result.data?.map((row, i) => (
              <TableRow key={i}>
                {fields.map((field, j) => {
                  return (
                    <TableBodyCell key={j}>
                      {topEvents && i < topEvents && j === 0 && (
                        <TopResultsIndicator index={i} />
                      )}
                      <FieldRenderer
                        column={columns[j]}
                        dataset={dataset}
                        data={row}
                        unit={meta?.units?.[field]}
                        meta={meta}
                      />
                    </TableBodyCell>
                  );
                })}
              </TableRow>
            ))
          ) : (
            <TableStatus>
              <EmptyStateWarning>
                <p>{t('No spans found')}</p>
              </EmptyStateWarning>
            </TableStatus>
          )}
        </TableBody>
      </Table>
      <Pagination pageLinks={result.pageLinks} />
    </Fragment>
  );
}

const TopResultsIndicator = styled('div')<{index: number}>`
  position: absolute;
  left: -1px;
  margin-top: 4.5px;
  width: 9px;
  height: 15px;
  border-radius: 0 3px 3px 0;

  background-color: ${p => {
    return CHART_PALETTE[TOP_EVENTS_LIMIT - 1][p.index];
  }};
`;
