import {Fragment, useMemo} from 'react';
import styled from '@emotion/styled';

import EmptyStateWarning from 'sentry/components/emptyStateWarning';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import Pagination from 'sentry/components/pagination';
import {IconArrow} from 'sentry/icons/iconArrow';
import {IconWarning} from 'sentry/icons/iconWarning';
import {t} from 'sentry/locale';
import type {NewQuery} from 'sentry/types/organization';
import {defined} from 'sentry/utils';
import EventView from 'sentry/utils/discover/eventView';
import {fieldAlignment} from 'sentry/utils/discover/fields';
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
import {useSpanTags} from 'sentry/views/explore/contexts/spanTagsContext';
import {useDataset} from 'sentry/views/explore/hooks/useDataset';
import {useSampleFields} from 'sentry/views/explore/hooks/useSampleFields';
import {useSorts} from 'sentry/views/explore/hooks/useSorts';
import {useUserQuery} from 'sentry/views/explore/hooks/useUserQuery';
import {useSpansQuery} from 'sentry/views/insights/common/queries/useSpansQuery';

import {FieldRenderer} from './fieldRenderer';

interface SpansTableProps {}

export function SpansTable({}: SpansTableProps) {
  const {selection} = usePageFilters();

  const [dataset] = useDataset();
  const [fields] = useSampleFields();
  const [sorts, setSorts] = useSorts({fields});
  const [query] = useUserQuery();

  const eventView = useMemo(() => {
    const queryFields = [
      ...fields,
      'project',
      'trace',
      'transaction.span_id',
      'span_id',
      'timestamp',
    ];

    const discoverQuery: NewQuery = {
      id: undefined,
      name: 'Explore - Span Samples',
      fields: queryFields,
      orderby: sorts.map(sort => `${sort.kind === 'desc' ? '-' : ''}${sort.field}`),
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
    referrer: 'api.explore.spans-samples-table',
    allowAggregateConditions: false,
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

  const numberTags = useSpanTags('number');
  const stringTags = useSpanTags('string');

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
              const tag = stringTags[field] ?? numberTags[field] ?? null;

              const direction = sorts.find(s => s.field === field)?.kind;

              function updateSort() {
                const kind = direction === 'desc' ? 'asc' : 'desc';
                setSorts([{field, kind}]);
              }

              return (
                <StyledTableHeadCell
                  align={align}
                  key={i}
                  isFirst={i === 0}
                  onClick={updateSort}
                >
                  <span>{tag?.name ?? field}</span>
                  {defined(direction) && (
                    <IconArrow
                      size="xs"
                      direction={
                        direction === 'desc'
                          ? 'down'
                          : direction === 'asc'
                            ? 'up'
                            : undefined
                      }
                    />
                  )}
                </StyledTableHeadCell>
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
                      <FieldRenderer
                        column={columns[j]}
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

const StyledTableHeadCell = styled(TableHeadCell)`
  cursor: pointer;
`;
