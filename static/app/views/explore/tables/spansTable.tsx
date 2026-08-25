import {Fragment, useMemo} from 'react';

import {Pagination} from '@sentry/scraps/pagination';

import {EmptyStateWarning} from 'sentry/components/emptyStateWarning';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {DataTable} from 'sentry/components/tables/dataTable';
import {IconWarning} from 'sentry/icons/iconWarning';
import {t} from 'sentry/locale';
import type {TagCollection} from 'sentry/types/group';
import type {MetaType} from 'sentry/utils/discover/eventView';
import {fieldAlignment} from 'sentry/utils/discover/fields';
import {FieldValueType, getFieldDefinition, prettifyTagKey} from 'sentry/utils/fields';
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
      <DataTable
        data-test-id="spans-table"
        fields={visibleFields}
        minimumColumnWidth={50}
      >
        <DataTable.Head>
          <DataTable.Row>
            {visibleFields.map((field, i) => {
              // Hide column names before alignment is determined
              if (result.isPending) {
                return <DataTable.HeadCell key={i} isFirst={i === 0} />;
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
                <DataTable.HeadCell
                  align={align}
                  columnIndex={i}
                  key={i}
                  isFirst={i === 0}
                  onSort={updateSort}
                  sort={direction}
                >
                  {label}
                </DataTable.HeadCell>
              );
            })}
          </DataTable.Row>
        </DataTable.Head>
        <DataTable.Body>
          {result.isPending ? (
            <DataTable.Status>
              <LoadingIndicator />
            </DataTable.Status>
          ) : result.isError ? (
            <DataTable.Status>
              <IconWarning data-test-id="error-indicator" variant="muted" size="lg" />
            </DataTable.Status>
          ) : result.isFetched && result.data?.length ? (
            result.data?.map((row, i) => (
              <DataTable.Row key={i}>
                {visibleFields.map((field, j) => {
                  return (
                    <DataTable.Cell key={j}>
                      <FieldRenderer
                        column={columnsFromEventView[j]}
                        data={row}
                        unit={meta?.units?.[field]}
                        meta={meta}
                      />
                    </DataTable.Cell>
                  );
                })}
              </DataTable.Row>
            ))
          ) : (
            <DataTable.Status>
              <EmptyStateWarning>
                <p>{t('No spans found')}</p>
              </EmptyStateWarning>
            </DataTable.Status>
          )}
        </DataTable.Body>
      </DataTable>
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
