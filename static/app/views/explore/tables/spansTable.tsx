import {Fragment, useMemo} from 'react';

import {Pagination} from '@sentry/scraps/pagination';

import {EmptyStateWarning} from 'sentry/components/emptyStateWarning';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {GridStatus} from 'sentry/components/tables/gridEditable/styles';
import {IconWarning} from 'sentry/icons/iconWarning';
import {t} from 'sentry/locale';
import type {TagCollection} from 'sentry/types/group';
import type {MetaType} from 'sentry/utils/discover/eventView';
import {fieldAlignment} from 'sentry/utils/discover/fields';
import {FieldValueType, getFieldDefinition, prettifyTagKey} from 'sentry/utils/fields';
import {
  Table,
  TableBody,
  TableBodyCell,
  TableHead,
  TableHeadCell,
  TableRow,
} from 'sentry/views/explore/components/table';
import type {SpansTableResult} from 'sentry/views/explore/hooks/useExploreSpansTable';
import {usePaginationAnalytics} from 'sentry/views/explore/hooks/usePaginationAnalytics';
import {
  useQueryParamsFields,
  useQueryParamsSortBys,
  useSetQueryParamsSortBys,
} from 'sentry/views/explore/queryParams/context';

import {FieldRenderer} from './fieldRenderer';

interface SpansTableProps {
  booleanTags: TagCollection;
  numberTags: TagCollection;
  spansTableResult: SpansTableResult;
  stringTags: TagCollection;
  validatedFieldTypes: Partial<Record<string, FieldValueType>>;
}

export function SpansTable({
  booleanTags,
  numberTags,
  spansTableResult,
  stringTags,
  validatedFieldTypes,
}: SpansTableProps) {
  const fields = useQueryParamsFields();
  const sortBys = useQueryParamsSortBys();
  const setSortBys = useSetQueryParamsSortBys();

  const visibleFields = useMemo(
    () => (fields.includes('id') ? [...fields] : ['id', ...fields]),
    [fields]
  );

  const {result, eventView} = spansTableResult;

  const meta = useMemo(
    () =>
      addValidatedFieldTypesToMeta({
        meta: result.meta ?? {},
        validatedFieldTypes,
      }),
    [result.meta, validatedFieldTypes]
  );
  const columnsFromEventView = useMemo(
    () => eventView.getColumns(meta),
    [eventView, meta]
  );

  const paginationAnalyticsEvent = usePaginationAnalytics(
    'samples',
    result.data?.length ?? 0
  );

  return (
    <Fragment>
      <Table data-test-id="spans-table" fields={visibleFields} minimumColumnWidth={50}>
        <TableHead>
          <TableRow>
            {visibleFields.map((field, i) => {
              // Hide column names before alignment is determined
              if (result.isPending) {
                return <TableHeadCell key={i} isFirst={i === 0} />;
              }

              const fieldType = meta.fields?.[field];
              const align = fieldAlignment(field, fieldType);
              const tag =
                stringTags[field] ?? numberTags[field] ?? booleanTags[field] ?? null;

              const direction = sortBys.find(s => s.field === field)?.kind;

              function updateSort() {
                const kind = direction === 'desc' ? 'asc' : 'desc';
                setSortBys([{field, kind}]);
              }

              const label = tag?.name ?? prettifyTagKey(field);

              return (
                <TableHeadCell
                  align={align}
                  columnIndex={i}
                  key={i}
                  isFirst={i === 0}
                  onSort={updateSort}
                  sort={direction}
                >
                  {label}
                </TableHeadCell>
              );
            })}
          </TableRow>
        </TableHead>
        <TableBody>
          {result.isPending ? (
            <GridStatus>
              <LoadingIndicator />
            </GridStatus>
          ) : result.isError ? (
            <GridStatus>
              <IconWarning data-test-id="error-indicator" variant="muted" size="lg" />
            </GridStatus>
          ) : result.isFetched && result.data?.length ? (
            result.data?.map((row, i) => (
              <TableRow key={i}>
                {visibleFields.map((field, j) => {
                  return (
                    <TableBodyCell key={j}>
                      <FieldRenderer
                        column={columnsFromEventView[j]}
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
            <GridStatus>
              <EmptyStateWarning>
                <p>{t('No spans found')}</p>
              </EmptyStateWarning>
            </GridStatus>
          )}
        </TableBody>
      </Table>
      <Pagination
        pageLinks={result.pageLinks}
        paginationAnalyticsEvent={paginationAnalyticsEvent}
      />
    </Fragment>
  );
}

export function addValidatedFieldTypesToMeta({
  meta,
  validatedFieldTypes,
}: {
  meta: MetaType;
  validatedFieldTypes: Partial<Record<string, FieldValueType>>;
}): MetaType {
  const fields = {...meta?.fields};

  for (const [field, validatedType] of Object.entries(validatedFieldTypes)) {
    fields[field] =
      getFieldDefinition(field, 'span')?.valueType ?? fields[field] ?? validatedType;
  }

  return {...meta, fields};
}
