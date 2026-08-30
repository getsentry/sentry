import {Fragment, useMemo, useState} from 'react';
import styled from '@emotion/styled';

import {Button} from '@sentry/scraps/button';
import {Pagination} from '@sentry/scraps/pagination';

import {EmptyStateWarning} from 'sentry/components/emptyStateWarning';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {DataTable} from 'sentry/components/tables/dataTable';
import {IconChevron} from 'sentry/icons/iconChevron';
import {IconWarning} from 'sentry/icons/iconWarning';
import {t} from 'sentry/locale';
import type {TagCollection} from 'sentry/types/group';
import {trackAnalytics} from 'sentry/utils/analytics';
import type {EventData, MetaType} from 'sentry/utils/discover/eventView';
import {fieldAlignment} from 'sentry/utils/discover/fields';
import {FieldValueType, getFieldDefinition, prettifyTagKey} from 'sentry/utils/fields';
import {useOrganization} from 'sentry/utils/useOrganization';
import type {TableColumn} from 'sentry/views/discover/table/types';
import type {SpansTableResult} from 'sentry/views/explore/hooks/useExploreSpansTable';
import {usePaginationAnalytics} from 'sentry/views/explore/hooks/usePaginationAnalytics';
import {
  useQueryParamsCursor,
  useQueryParamsFields,
  useQueryParamsQuery,
  useQueryParamsSortBys,
  useSetQueryParamsSortBys,
} from 'sentry/views/explore/queryParams/context';

import {FieldRenderer} from './fieldRenderer';
import {SpanItemDetails} from './spanItemDetails';

const SPAN_DETAILS_COLUMN_WIDTH = 40;

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
  const query = useQueryParamsQuery();
  const cursor = useQueryParamsCursor();
  const sortBys = useQueryParamsSortBys();
  const setSortBys = useSetQueryParamsSortBys();
  const organization = useOrganization();
  const canExpandSpanDetails = organization.features.includes(
    'explore-span-item-details'
  );

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
  const expansionResetKey = useMemo(
    () => JSON.stringify([query, cursor, fields, sortBys]),
    [cursor, fields, query, sortBys]
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
        prefixColumnWidth={canExpandSpanDetails ? SPAN_DETAILS_COLUMN_WIDTH : undefined}
      >
        <DataTable.Head>
          <DataTable.Row>
            {canExpandSpanDetails && (
              <SpanDetailsToggleHeadCell aria-label={t('Span details')} isFirst />
            )}
            {visibleFields.map((field, i) => {
              // Hide column names before alignment is determined
              if (result.isPending) {
                return (
                  <DataTable.HeadCell
                    key={i}
                    isFirst={!canExpandSpanDetails && i === 0}
                  />
                );
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
                  isFirst={!canExpandSpanDetails && i === 0}
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
              <SpanSampleRow
                key={`${expansionResetKey}:${getSpanKey(row, i)}`}
                canExpandSpanDetails={canExpandSpanDetails}
                columns={columnsFromEventView}
                data={row}
                fields={visibleFields}
                meta={meta}
              />
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

function SpanSampleRow({
  canExpandSpanDetails,
  columns,
  data,
  fields,
  meta,
}: {
  canExpandSpanDetails: boolean;
  columns: Array<TableColumn<string>>;
  data: EventData;
  fields: readonly string[];
  meta: MetaType;
}) {
  const organization = useOrganization();
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <Fragment>
      <DataTable.Row>
        {canExpandSpanDetails ? (
          <SpanDetailsToggleCell>
            <Button
              aria-expanded={isExpanded}
              aria-label={isExpanded ? t('Hide span details') : t('Show span details')}
              icon={<IconChevron size="xs" direction={isExpanded ? 'down' : 'right'} />}
              size="zero"
              variant="transparent"
              onClick={() => {
                setIsExpanded(e => !e);
                trackAnalytics('trace_explorer.toggle_span_details', {
                  organization,
                  expanded: !isExpanded,
                });
              }}
            />
          </SpanDetailsToggleCell>
        ) : null}
        {fields.map((field, index) => (
          <DataTable.Cell key={field}>
            <FieldRenderer
              column={columns[index]}
              data={data}
              unit={meta.units?.[field]}
              meta={meta}
            />
          </DataTable.Cell>
        ))}
      </DataTable.Row>
      {canExpandSpanDetails && isExpanded ? (
        <DataTable.Row>
          <SpanDetailsCell>
            <SpanItemDetails dataRow={data} />
          </SpanDetailsCell>
        </DataTable.Row>
      ) : null}
    </Fragment>
  );
}

function getSpanKey(row: EventData, index: number) {
  return (
    [row.project, row.trace, row.id, row.timestamp].filter(Boolean).join(':') || index
  );
}

const SpanDetailsToggleHeadCell = styled(DataTable.HeadCell)`
  align-items: center;
  padding: 0;
`;

const SpanDetailsToggleCell = styled(DataTable.Cell)`
  align-items: center;
  padding: 0;
`;

const SpanDetailsCell = styled(DataTable.Cell)`
  background-color: ${p => p.theme.colors.gray100};
  grid-column: 1 / -1;
  padding: ${p => p.theme.space.md};
`;

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
