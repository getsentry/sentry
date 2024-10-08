import {Fragment, useMemo} from 'react';

import EmptyStateWarning from 'sentry/components/emptyStateWarning';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import Pagination from 'sentry/components/pagination';
import {IconWarning} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {NewQuery} from 'sentry/types/organization';
import EventView from 'sentry/utils/discover/eventView';
import {fieldAlignment} from 'sentry/utils/discover/fields';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import usePageFilters from 'sentry/utils/usePageFilters';
import CellAction, {updateQuery} from 'sentry/views/discover/table/cellAction';
import {
  ALLOWED_CELL_ACTIONS,
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
  const [sorts] = useSorts({fields});
  const [userQuery, setUserQuery] = useUserQuery();

  const eventView = useMemo(() => {
    const queryFields = [
      ...fields,
      'project',
      'trace',
      'transaction.id',
      'span_id',
      'timestamp',
    ];

    const discoverQuery: NewQuery = {
      id: undefined,
      name: 'Explore - Span Samples',
      fields: queryFields,
      orderby: sorts.map(sort => `${sort.kind === 'desc' ? '-' : ''}${sort.field}`),
      query: userQuery,
      version: 2,
      dataset,
    };

    return EventView.fromNewQueryWithPageFilters(discoverQuery, selection);
  }, [dataset, fields, sorts, userQuery, selection]);

  const result = useSpansQuery({
    eventView,
    initialData: [],
    referrer: 'api.explore.spans-samples-table',
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
                  const column = eventView.getColumns()[j];
                  const query = new MutableSearch(eventView.query);
                  return (
                    <TableBodyCell key={j}>
                      <CellAction
                        column={column}
                        dataRow={row}
                        handleCellAction={(actions, value) => {
                          updateQuery(query, actions, column, value);
                          setUserQuery(query.formatString());
                        }}
                        allowActions={ALLOWED_CELL_ACTIONS}
                      >
                        <FieldRenderer
                          dataset={dataset}
                          data={row}
                          field={field}
                          unit={meta?.units?.[field]}
                          meta={meta}
                        />
                      </CellAction>
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
