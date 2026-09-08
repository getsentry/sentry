import {Fragment, useEffect, useMemo, useRef, useState} from 'react';
import styled from '@emotion/styled';

import {Button} from '@sentry/scraps/button';
import {Flex} from '@sentry/scraps/layout';
import {Pagination} from '@sentry/scraps/pagination';
import {Text} from '@sentry/scraps/text';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import {EmptyStateWarning} from 'sentry/components/emptyStateWarning';
import {LoadingError} from 'sentry/components/loadingError';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {Placeholder} from 'sentry/components/placeholder';
import {DataTable} from 'sentry/components/tables/dataTable';
import {getNextDirection} from 'sentry/components/tables/getNextSort';
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
  useSetQueryParamsFields,
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

interface ResolvedSpanTable {
  data: EventData[];
  dataUpdatedAt: number;
  fields: readonly string[];
  identityKey: string;
  meta: MetaType;
  pageLinks: string | undefined;
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
  const setFields = useSetQueryParamsFields();
  const setSortBys = useSetQueryParamsSortBys();
  const organization = useOrganization();
  const canExpandSpanDetails = organization.features.includes(
    'explore-span-item-details'
  );

  const visibleFields = useMemo(
    () => (fields.includes('id') ? [...fields] : ['id', ...fields]),
    [fields]
  );

  const {eventView, requestIdentityKey, result} = spansTableResult;

  const tableIdentityKey = useMemo(
    () =>
      JSON.stringify([
        requestIdentityKey ?? cursor,
        eventView.dataset,
        eventView.end,
        eventView.environment,
        eventView.project,
        query,
        sortBys,
        eventView.start,
        eventView.statsPeriod,
        eventView.utc,
      ]),
    [cursor, eventView, query, requestIdentityKey, sortBys]
  );
  const resolvedTable = useMemo<Omit<ResolvedSpanTable, 'fields'> | null>(() => {
    if (result.isSuccess && !result.isPlaceholderData && result.data) {
      return {
        data: result.data,
        dataUpdatedAt: result.dataUpdatedAt,
        identityKey: tableIdentityKey,
        meta: result.meta ?? {},
        pageLinks: result.pageLinks,
      };
    }
    return null;
  }, [result, tableIdentityKey]);
  const [lastResolvedTable, setLastResolvedTable] = useState<ResolvedSpanTable | null>(
    resolvedTable ? {...resolvedTable, fields} : null
  );
  const rolledBackErrorRef = useRef<SpansTableResult['result']['error']>(null);

  if (
    resolvedTable &&
    (resolvedTable.data !== lastResolvedTable?.data ||
      resolvedTable.dataUpdatedAt !== lastResolvedTable?.dataUpdatedAt ||
      resolvedTable.identityKey !== lastResolvedTable?.identityKey)
  ) {
    setLastResolvedTable({...resolvedTable, fields});
  }

  const canRetainLastResolvedTable = lastResolvedTable?.identityKey === tableIdentityKey;
  const isLoadingDifferentTable = result.isPlaceholderData && !canRetainLastResolvedTable;
  const displayedData =
    !result.isPending && !result.isPlaceholderData && result.data
      ? result.data
      : canRetainLastResolvedTable
        ? lastResolvedTable.data
        : undefined;
  const displayedMeta =
    (isLoadingDifferentTable ? undefined : result.meta) ??
    (canRetainLastResolvedTable ? lastResolvedTable.meta : undefined);
  const displayedPageLinks =
    (result.isPlaceholderData || result.isError) && canRetainLastResolvedTable
      ? lastResolvedTable.pageLinks
      : result.pageLinks;
  const addedFields = useMemo(
    () =>
      canRetainLastResolvedTable
        ? fields.filter(field => !lastResolvedTable.fields.includes(field))
        : [],
    [canRetainLastResolvedTable, fields, lastResolvedTable]
  );
  const isRetainedError =
    result.isError && canRetainLastResolvedTable && Boolean(displayedData?.length);
  const isFieldAdditionError = result.isError && addedFields.length > 0;
  const pendingFields = new Set(result.isFetching ? addedFields : []);

  useEffect(() => {
    if (
      !result.isError ||
      !lastResolvedTable ||
      addedFields.length === 0 ||
      rolledBackErrorRef.current === result.error
    ) {
      return;
    }

    rolledBackErrorRef.current = result.error;
    setFields([...lastResolvedTable.fields], {replace: true});
    addErrorMessage(t('Failed to add column'));
  }, [addedFields, lastResolvedTable, result.error, result.isError, setFields]);

  const meta = useMemo(
    () =>
      addValidatedFieldTypesToMeta({
        meta: displayedMeta ?? {},
        validatedFieldTypes,
      }),
    [displayedMeta, validatedFieldTypes]
  );
  const columnsFromEventView = useMemo(
    () => eventView.getColumns(meta),
    [eventView, meta]
  );
  const paginationAnalyticsEvent = usePaginationAnalytics(
    'samples',
    displayedData?.length ?? 0
  );

  return (
    <Fragment>
      <DataTable
        aria-busy={result.isFetching}
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
              if (result.isPending || isLoadingDifferentTable) {
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
                setSortBys([{field, kind: getNextDirection(direction)}]);
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
                  <Flex align="center" gap="xs">
                    <Text as="span" size="sm" variant="inherit">
                      {label}
                    </Text>
                    {pendingFields.has(field) ? (
                      <LoadingIndicator
                        data-test-id="column-loading-indicator"
                        size={12}
                        style={{margin: 0}}
                      />
                    ) : null}
                  </Flex>
                </DataTable.HeadCell>
              );
            })}
          </DataTable.Row>
        </DataTable.Head>
        <DataTable.Body>
          {(result.isPending || isLoadingDifferentTable) && !displayedData ? (
            <DataTable.Status>
              <LoadingIndicator />
            </DataTable.Status>
          ) : result.isError && !isRetainedError ? (
            <DataTable.Status>
              <IconWarning data-test-id="error-indicator" variant="muted" size="lg" />
            </DataTable.Status>
          ) : displayedData?.length ? (
            displayedData.map((row, i) => (
              <SpanSampleRow
                key={`${tableIdentityKey}:${getSpanKey(row, i)}`}
                canExpandSpanDetails={canExpandSpanDetails}
                columns={columnsFromEventView}
                data={row}
                fields={visibleFields}
                pendingFields={pendingFields}
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
      {isRetainedError && !isFieldAdditionError ? (
        <LoadingError
          message={t('Failed to update span samples')}
          onRetry={() => void result.refetch()}
        />
      ) : null}
      <Pagination
        pageLinks={displayedPageLinks}
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
  pendingFields,
  meta,
}: {
  canExpandSpanDetails: boolean;
  columns: Array<TableColumn<string>>;
  data: EventData;
  fields: readonly string[];
  meta: MetaType;
  pendingFields: ReadonlySet<string>;
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
            {pendingFields.has(field) ? (
              <Placeholder height="14px" width="60%" />
            ) : (
              <FieldRenderer
                column={columns[index]}
                data={data}
                unit={meta.units?.[field]}
                meta={meta}
              />
            )}
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
