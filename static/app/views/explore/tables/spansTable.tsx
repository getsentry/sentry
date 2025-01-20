import {Fragment, useMemo, useRef} from 'react';

import EmptyStateWarning from 'sentry/components/emptyStateWarning';
import {GridResizer} from 'sentry/components/gridEditable/styles';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import Pagination from 'sentry/components/pagination';
import {IconArrow} from 'sentry/icons/iconArrow';
import {IconWarning} from 'sentry/icons/iconWarning';
import {t} from 'sentry/locale';
import type {Confidence} from 'sentry/types/organization';
import {defined} from 'sentry/utils';
import {fieldAlignment, prettifyTagKey} from 'sentry/utils/discover/fields';
import useOrganization from 'sentry/utils/useOrganization';
import {decodeColumnOrder} from 'sentry/views/discover/utils';
import {
  Table,
  TableBody,
  TableBodyCell,
  TableHead,
  TableHeadCell,
  TableHeadCellContent,
  TableRow,
  TableStatus,
  useTableStyles,
} from 'sentry/views/explore/components/table';
import {
  useExploreDataset,
  useExploreFields,
  useExploreQuery,
  useExploreSortBys,
  useExploreTitle,
  useExploreVisualizes,
  useSetExploreSortBys,
} from 'sentry/views/explore/contexts/pageParamsContext';
import {useSpanTags} from 'sentry/views/explore/contexts/spanTagsContext';
import {useAnalytics} from 'sentry/views/explore/hooks/useAnalytics';
import type {SpansTableResult} from 'sentry/views/explore/hooks/useExploreSpansTable';

import {FieldRenderer} from './fieldRenderer';

interface SpansTableProps {
  confidences: Confidence[];
  spansTableResult: SpansTableResult;
}

export function SpansTable({confidences, spansTableResult}: SpansTableProps) {
  const dataset = useExploreDataset();
  const title = useExploreTitle();
  const fields = useExploreFields();
  const sortBys = useExploreSortBys();
  const setSortBys = useSetExploreSortBys();
  const query = useExploreQuery();
  const visualizes = useExploreVisualizes();
  const organization = useOrganization();

  const visibleFields = useMemo(
    () => (fields.includes('id') ? fields : ['id', ...fields]),
    [fields]
  );

  const columnsFromVisibleFields = useMemo(() => {
    return decodeColumnOrder(
      visibleFields.map(f => {
        return {field: f};
      })
    );
  }, [visibleFields]);

  useAnalytics({
    dataset,
    resultLength: spansTableResult.data?.length,
    resultMode: 'span samples',
    resultStatus: spansTableResult.status,
    visualizes,
    organization,
    columns: fields,
    userQuery: query,
    confidences,
    title,
  });

  const tableRef = useRef<HTMLTableElement>(null);
  const {initialTableStyles, onResizeMouseDown} = useTableStyles(visibleFields, tableRef);

  const meta = spansTableResult.meta ?? {};

  const numberTags = useSpanTags('number');
  const stringTags = useSpanTags('string');

  return (
    <Fragment>
      <Table ref={tableRef} styles={initialTableStyles}>
        <TableHead>
          <TableRow>
            {visibleFields.map((field, i) => {
              // Hide column names before alignment is determined
              if (spansTableResult.isPending) {
                return <TableHeadCell key={i} isFirst={i === 0} />;
              }

              const fieldType = meta.fields?.[field];
              const align = fieldAlignment(field, fieldType);
              const tag = stringTags[field] ?? numberTags[field] ?? null;

              const direction = sortBys.find(s => s.field === field)?.kind;

              function updateSort() {
                const kind = direction === 'desc' ? 'asc' : 'desc';
                setSortBys([{field, kind}]);
              }

              return (
                <TableHeadCell align={align} key={i} isFirst={i === 0}>
                  <TableHeadCellContent onClick={updateSort}>
                    <span>{tag?.name ?? prettifyTagKey(field)}</span>
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
                  </TableHeadCellContent>
                  {i !== visibleFields.length - 1 && (
                    <GridResizer
                      dataRows={
                        !spansTableResult.isError &&
                        !spansTableResult.isPending &&
                        spansTableResult.data
                          ? spansTableResult.data.length
                          : 0
                      }
                      onMouseDown={e => onResizeMouseDown(e, i)}
                    />
                  )}
                </TableHeadCell>
              );
            })}
          </TableRow>
        </TableHead>
        <TableBody>
          {spansTableResult.isPending ? (
            <TableStatus>
              <LoadingIndicator />
            </TableStatus>
          ) : spansTableResult.isError ? (
            <TableStatus>
              <IconWarning data-test-id="error-indicator" color="gray300" size="lg" />
            </TableStatus>
          ) : spansTableResult.isFetched && spansTableResult.data?.length ? (
            spansTableResult.data?.map((row, i) => (
              <TableRow key={i}>
                {visibleFields.map((field, j) => {
                  return (
                    <TableBodyCell key={j}>
                      <FieldRenderer
                        column={columnsFromVisibleFields[j]!}
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
      <Pagination pageLinks={spansTableResult.pageLinks} />
    </Fragment>
  );
}
