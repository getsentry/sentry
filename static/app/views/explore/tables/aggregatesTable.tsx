import {Fragment, useMemo} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import {DropdownMenu, type MenuItemProps} from '@sentry/scraps/dropdownMenu';
import {OverlayTrigger} from '@sentry/scraps/overlayTrigger';
import {Pagination, type CursorHandler} from '@sentry/scraps/pagination';

import {normalizeDateTimeParams} from 'sentry/components/pageFilters/parse';
import {usePageFilters} from 'sentry/components/pageFilters/usePageFilters';
import {DataTable} from 'sentry/components/tables/dataTable';
import {getNextDirection} from 'sentry/components/tables/getNextSort';
import {IconStack} from 'sentry/icons/iconStack';
import {t} from 'sentry/locale';
import type {TagCollection} from 'sentry/types/group';
import {parseCursor} from 'sentry/utils/cursor';
import {fieldAlignment} from 'sentry/utils/discover/fields';
import {prettifyTagKey, type FieldValueType} from 'sentry/utils/fields';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useProjects} from 'sentry/utils/useProjects';
import type {TableColumn} from 'sentry/views/discover/table/types';
import {isGroupBy} from 'sentry/views/explore/contexts/pageParamsContext/aggregateFields';
import {TOP_EVENTS_LIMIT} from 'sentry/views/explore/hooks/topEventsConstants';
import type {AggregatesTableResult} from 'sentry/views/explore/hooks/useExploreAggregatesTable';
import {usePaginationAnalytics} from 'sentry/views/explore/hooks/usePaginationAnalytics';
import {useTopEvents} from 'sentry/views/explore/hooks/useTopEvents';
import {
  useQueryParamsAggregateCursor,
  useQueryParamsAggregateFields,
  useQueryParamsAggregateSortBys,
  useQueryParamsFields,
  useQueryParamsGroupBys,
  useQueryParamsQuery,
  useQueryParamsVisualizes,
  useSetQueryParamsAggregateSortBys,
} from 'sentry/views/explore/queryParams/context';
import {SPANS_AGGREGATE_CURSOR} from 'sentry/views/explore/spans/spansQueryParams';
import {FieldRenderer} from 'sentry/views/explore/tables/fieldRenderer';
import {addValidatedFieldTypesToMeta} from 'sentry/views/explore/tables/spansTable';
import {prettifyAggregation, viewSamplesTarget} from 'sentry/views/explore/utils';
import {SpanFields} from 'sentry/views/insights/types';
import {TraceViewSources} from 'sentry/views/performance/traceDetails/traceHeader/breadcrumbs';
import {getTraceDetailsUrl} from 'sentry/views/performance/traceDetails/traceUrl';

interface AggregatesTableProps {
  aggregatesTableResult: AggregatesTableResult;
  booleanTags: TagCollection;
  numberTags: TagCollection;
  stringTags: TagCollection;
  validatedFieldTypes: Partial<Record<string, FieldValueType>>;
}

export function AggregatesTable({
  aggregatesTableResult,
  booleanTags,
  numberTags,
  stringTags,
  validatedFieldTypes,
}: AggregatesTableProps) {
  const theme = useTheme();
  const location = useLocation();
  const navigate = useNavigate();
  const {projects} = useProjects();

  const {result, eventView} = aggregatesTableResult;

  const topEvents = useTopEvents();
  const aggregateFields = useQueryParamsAggregateFields();
  const fields = useQueryParamsFields();
  const groupBys = useQueryParamsGroupBys();
  const visualizes = useQueryParamsVisualizes();
  const sorts = useQueryParamsAggregateSortBys();
  const setSorts = useSetQueryParamsAggregateSortBys();
  const query = useQueryParamsQuery();
  const aggregateCursor = useQueryParamsAggregateCursor();
  const organization = useOrganization();
  const {selection} = usePageFilters();

  const visibleAggregateFields = useMemo(
    () =>
      aggregateFields.filter(aggregateField => {
        if (isGroupBy(aggregateField)) {
          return Boolean(aggregateField.groupBy);
        }
        return true;
      }),
    [aggregateFields]
  );

  const visibleFields = useMemo(
    () =>
      visibleAggregateFields.map(aggregateField =>
        isGroupBy(aggregateField) ? aggregateField.groupBy : aggregateField.yAxis
      ),
    [visibleAggregateFields]
  );

  const meta = useMemo(
    () =>
      addValidatedFieldTypesToMeta({
        meta: result.meta ?? {},
        validatedFieldTypes,
      }),
    [result.meta, validatedFieldTypes]
  );

  const numberOfRowsNeedingColor = Math.min(result.data?.length ?? 0, TOP_EVENTS_LIMIT);

  const palette = theme.chart.getColorPalette(numberOfRowsNeedingColor - 1);

  const cursorHandler: CursorHandler = (cursor, path, q) =>
    navigate({pathname: path, query: {...q, [SPANS_AGGREGATE_CURSOR]: cursor}});

  const paginationAnalyticsEvent = usePaginationAnalytics(
    'aggregates',
    result.data?.length ?? 0
  );

  const columns = useMemo(() => {
    return eventView
      .getColumns(meta)
      .reduce<Record<string, TableColumn<string>>>((acc, col) => {
        acc[col.key] = col;
        return acc;
      }, {});
  }, [eventView, meta]);

  return (
    <Fragment>
      <DataTable
        columns={visibleFields.map(field => ({key: field}))}
        minimumColumnWidth={50}
        prependColumnWidths={['min-content']}
        header={
          <DataTable.HeaderRow>
            <DataTable.HeaderCell />
            {visibleAggregateFields.map((aggregateField, i) => {
              // Hide column names before alignment is determined
              if (result.isPending) {
                return <DataTable.HeaderCell key={i} />;
              }

              const field = isGroupBy(aggregateField)
                ? aggregateField.groupBy
                : aggregateField.yAxis;

              const fieldType = meta.fields?.[field];
              const align = fieldAlignment(field, fieldType);
              const label = prettifyField(field, stringTags, numberTags, booleanTags);

              const direction = sorts.find(s => s.field === field)?.kind;

              function updateSort() {
                setSorts([{field, kind: getNextDirection(direction)}]);
              }

              return (
                <DataTable.HeaderCell
                  align={align}
                  columnIndex={i}
                  key={i}
                  handleSortClick={updateSort}
                  sort={direction}
                >
                  {label}
                </DataTable.HeaderCell>
              );
            })}
          </DataTable.HeaderRow>
        }
      >
        {result.isPending ? (
          <DataTable.Loading />
        ) : result.isError ? (
          <DataTable.Error />
        ) : result.isFetched && result.data?.length ? (
          result.data?.map((row, i) => {
            const menuItems: MenuItemProps[] = [
              {
                key: 'view-samples',
                label: t('View Samples'),
                to: viewSamplesTarget({
                  location,
                  query,
                  fields,
                  groupBys,
                  visualizes,
                  sorts,
                  row,
                  projects,
                }),
              },
            ];

            const traceSlug = row[`any(${SpanFields.TRACE})`];
            const timestamp = row[`any(${SpanFields.TIMESTAMP})`];
            if (traceSlug && timestamp) {
              menuItems.push({
                key: 'view-random-trace',
                label: t('View Random Trace'),
                to: getTraceDetailsUrl({
                  organization,
                  traceSlug,
                  timestamp,
                  targetId: undefined,
                  eventId: undefined,
                  location,
                  source: TraceViewSources.TRACES,
                  dateSelection: normalizeDateTimeParams(selection.datetime),
                }),
              });
            }

            return (
              <DataTable.Row key={i}>
                <DataTable.RowCell>
                  {topEvents &&
                    i < topEvents &&
                    !parseCursor(aggregateCursor)?.offset && (
                      <TopResultsIndicator color={palette[i]!} />
                    )}
                  <DropdownMenu
                    items={menuItems}
                    usePortal
                    strategy="fixed"
                    size="sm"
                    offset={4}
                    minMenuWidth={0}
                    trigger={triggerProps => (
                      <OverlayTrigger.IconButton
                        {...triggerProps}
                        aria-label={t('View Samples')}
                        icon={<IconStack />}
                        variant="transparent"
                        size="zero"
                      />
                    )}
                  />
                </DataTable.RowCell>
                {visibleAggregateFields.map((aggregateField, j) => {
                  const field = isGroupBy(aggregateField)
                    ? aggregateField.groupBy
                    : aggregateField.yAxis;

                  return (
                    <DataTable.RowCell key={j}>
                      <FieldRenderer
                        column={columns[field]}
                        data={row}
                        disableTraceLinks
                        unit={meta?.units?.[field]}
                        meta={meta}
                      />
                    </DataTable.RowCell>
                  );
                })}
              </DataTable.Row>
            );
          })
        ) : (
          <DataTable.Empty>{t('No spans found')}</DataTable.Empty>
        )}
      </DataTable>
      <Pagination
        pageLinks={result.pageLinks}
        paginationAnalyticsEvent={paginationAnalyticsEvent}
        onCursor={cursorHandler}
      />
    </Fragment>
  );
}

function prettifyField(
  field: string,
  stringTags: TagCollection,
  numberTags: TagCollection,
  booleanTags: TagCollection
): string {
  const prettifiedAggregation = prettifyAggregation(field);
  if (prettifiedAggregation) {
    return prettifiedAggregation;
  }

  const tag = stringTags[field] ?? numberTags[field] ?? booleanTags[field] ?? null;
  if (tag) {
    return tag.name;
  }

  return prettifyTagKey(field);
}

const TopResultsIndicator = styled('div')<{color: string}>`
  position: absolute;
  left: -1px;
  width: 9px;
  height: 16px;
  border-radius: 0 3px 3px 0;

  background-color: ${p => p.color};
`;
