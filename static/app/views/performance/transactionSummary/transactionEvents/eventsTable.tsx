import type React from 'react';
import {Fragment, useCallback, useMemo, useState, type ReactNode} from 'react';
import type {Theme} from '@emotion/react';
import styled from '@emotion/styled';
import type {Location, LocationDescriptor, LocationDescriptorObject} from 'history';
import groupBy from 'lodash/groupBy';

import {LinkButton} from 'sentry/components/core/button/linkButton';
import {Link} from 'sentry/components/core/link';
import {Tooltip} from 'sentry/components/core/tooltip';
import Pagination from 'sentry/components/pagination';
import QuestionTooltip from 'sentry/components/questionTooltip';
import GridEditable from 'sentry/components/tables/gridEditable';
import SortLink from 'sentry/components/tables/gridEditable/sortLink';
import useStateBasedColumnResize from 'sentry/components/tables/gridEditable/useStateBasedColumnResize';
import {IconProfiling} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import type {IssueAttachment} from 'sentry/types/group';
import type {RouteContextInterface} from 'sentry/types/legacyReactRouter';
import type {Organization} from 'sentry/types/organization';
import {trackAnalytics} from 'sentry/utils/analytics';
import toArray from 'sentry/utils/array/toArray';
import {browserHistory} from 'sentry/utils/browserHistory';
import type {TableData, TableDataRow} from 'sentry/utils/discover/discoverQuery';
import DiscoverQuery from 'sentry/utils/discover/discoverQuery';
import type EventView from 'sentry/utils/discover/eventView';
import {isFieldSortable} from 'sentry/utils/discover/eventView';
import {getFieldRenderer} from 'sentry/utils/discover/fieldRenderers';
import {
  fieldAlignment,
  getAggregateAlias,
  isSpanOperationBreakdownField,
  SPAN_OP_RELATIVE_BREAKDOWN_FIELD,
} from 'sentry/utils/discover/fields';
import {generateLinkToEventInTraceView} from 'sentry/utils/discover/urls';
import ViewReplayLink from 'sentry/utils/discover/viewReplayLink';
import {isEmptyObject} from 'sentry/utils/object/isEmptyObject';
import parseLinkHeader from 'sentry/utils/parseLinkHeader';
import {VisuallyCompleteWithData} from 'sentry/utils/performanceForSentry';
import useApi from 'sentry/utils/useApi';
import CellAction, {Actions, updateQuery} from 'sentry/views/discover/table/cellAction';
import type {TableColumn} from 'sentry/views/discover/table/types';
import type {DomainViewFilters} from 'sentry/views/insights/pages/useFilters';
import {COLUMN_TITLES} from 'sentry/views/performance/data';
import {TraceViewSources} from 'sentry/views/performance/newTraceDetails/traceHeader/breadcrumbs';
import {
  generateProfileLink,
  generateReplayLink,
  generateTraceLink,
  normalizeSearchConditions,
} from 'sentry/views/performance/transactionSummary/utils';

import type {TitleProps} from './operationSort';
import OperationSort from './operationSort';

function shouldRenderColumn(containsSpanOpsBreakdown: boolean, col: string): boolean {
  if (containsSpanOpsBreakdown && isSpanOperationBreakdownField(col)) {
    return false;
  }

  if (
    col === 'profiler.id' ||
    col === 'thread.id' ||
    col === 'precise.start_ts' ||
    col === 'precise.finish_ts'
  ) {
    return false;
  }

  return true;
}

function OperationTitle({onClick}: TitleProps) {
  return (
    <div onClick={onClick}>
      <span>{t('operation duration')}</span>
      <StyledIconQuestion
        size="xs"
        position="top"
        title={t(
          `Span durations are summed over the course of an entire transaction. Any overlapping spans are only counted once.`
        )}
      />
    </div>
  );
}

type Props = {
  eventView: EventView;
  location: Location;
  organization: Organization;
  routes: RouteContextInterface['routes'];
  setError: (msg: string | undefined) => void;
  theme: Theme;
  transactionName: string;
  applyEnvironmentFilter?: boolean;
  columnTitles?: string[];
  customColumns?: Array<'attachments' | 'minidump'>;
  domainViewFilters?: DomainViewFilters;
  excludedTags?: string[];
  hidePagination?: boolean;
  isEventLoading?: boolean;
  isRegressionIssue?: boolean;
  issueId?: string;
  projectSlug?: string;
  referrer?: string;
  renderTableHeader?: (props: {
    isPending: boolean;
    pageEventsCount: number;
    pageLinks: string | null;
    totalEventsCount: string | number;
  }) => ReactNode;
};

export default function EventsTable({
  eventView,
  location,
  organization,
  routes,
  setError,
  theme,
  transactionName,
  applyEnvironmentFilter,
  columnTitles: initialColumnTitles,
  customColumns,
  domainViewFilters,
  excludedTags,
  hidePagination,
  isEventLoading,
  isRegressionIssue,
  issueId,
  projectSlug,
  referrer,
  renderTableHeader,
}: Props) {
  const api = useApi({persistInFlight: true});
  const [lastFetchedCursor, setLastFetchedCursor] = useState('');
  const [attachments, setAttachments] = useState<IssueAttachment[]>([]);
  const [hasMinidumps, setHasMinidumps] = useState(false);

  const replayLinkGenerator = useMemo(() => generateReplayLink(routes), [routes]);

  const handleCellAction = useCallback(
    (column: TableColumn<keyof TableDataRow>) => {
      return (action: Actions, value: string | number) => {
        trackAnalytics('performance_views.transactionEvents.cellaction', {
          organization,
          action,
        });

        const searchConditions = normalizeSearchConditions(eventView.query);

        if (excludedTags) {
          excludedTags.forEach(tag => {
            searchConditions.removeFilter(tag);
          });
        }

        updateQuery(searchConditions, action, column, value);

        if (applyEnvironmentFilter && column.key === 'environment') {
          let newEnvs = toArray(location.query.environment);

          if (action === Actions.ADD) {
            if (!newEnvs.includes(String(value))) {
              newEnvs.push(String(value));
            }
          } else {
            newEnvs = newEnvs.filter(env => env !== value);
          }

          browserHistory.push({
            pathname: location.pathname,
            query: {
              ...location.query,
              cursor: undefined,
              environment: newEnvs,
            },
          });
          return;
        }

        browserHistory.push({
          pathname: location.pathname,
          query: {
            ...location.query,
            cursor: undefined,
            query: searchConditions.formatString(),
          },
        });
      };
    },
    [organization, eventView, excludedTags, applyEnvironmentFilter, location]
  );

  const renderBodyCell = useCallback(
    (
      tableData: TableData | null,
      column: TableColumn<keyof TableDataRow>,
      dataRow: TableDataRow
    ): React.ReactNode => {
      if (!tableData?.meta) {
        return dataRow[column.key];
      }
      const tableMeta = tableData.meta;
      const field = String(column.key);
      const fieldRenderer = getFieldRenderer(field, tableMeta);
      const rendered = fieldRenderer(dataRow, {
        organization,
        location,
        eventView,
        theme,
        projectSlug,
      });

      const allowActions = [
        Actions.ADD,
        Actions.EXCLUDE,
        Actions.SHOW_GREATER_THAN,
        Actions.SHOW_LESS_THAN,
        Actions.OPEN_EXTERNAL_LINK,
        Actions.OPEN_INTERNAL_LINK,
      ];

      if (['attachments', 'minidump'].includes(field)) {
        return rendered;
      }

      const cellActionHandler = handleCellAction(column);

      if (field === 'id' || field === 'trace') {
        const isIssue = !!issueId;
        let target: LocationDescriptor = {};
        if (isIssue && !isRegressionIssue && field === 'id') {
          target.pathname = `/organizations/${organization.slug}/issues/${issueId}/events/${dataRow.id}/`;
        } else {
          if (field === 'id') {
            const traceSlug = dataRow.trace?.toString();
            if (traceSlug) {
              target = generateLinkToEventInTraceView({
                traceSlug,
                eventId: dataRow.id,
                timestamp: dataRow.timestamp!,
                location,
                organization,
                source: TraceViewSources.PERFORMANCE_TRANSACTION_SUMMARY,
                view: domainViewFilters?.view,
              });
            }
          } else {
            target = generateTraceLink(transactionName, domainViewFilters?.view)(
              organization,
              dataRow,
              location
            );
          }
        }

        return (
          <CellAction
            column={column}
            dataRow={dataRow}
            handleCellAction={cellActionHandler}
            allowActions={allowActions}
          >
            <Link to={target}>{rendered}</Link>
          </CellAction>
        );
      }

      if (field === 'replayId') {
        const target: LocationDescriptor | null = dataRow.replayId
          ? replayLinkGenerator(organization, dataRow, undefined)
          : null;

        return (
          <CellAction
            column={column}
            dataRow={dataRow}
            handleCellAction={cellActionHandler}
            allowActions={allowActions}
          >
            {target ? (
              <ViewReplayLink replayId={dataRow.replayId!} to={target}>
                {rendered}
              </ViewReplayLink>
            ) : (
              rendered
            )}
          </CellAction>
        );
      }

      if (field === 'profile.id') {
        const target = generateProfileLink()(organization, dataRow, undefined);
        const transactionMeetsProfilingRequirements =
          typeof dataRow['transaction.duration'] === 'number' &&
          dataRow['transaction.duration'] > 20;

        return (
          <Tooltip
            title={
              !transactionMeetsProfilingRequirements && !dataRow['profile.id']
                ? t('Profiles require a transaction duration of at least 20ms')
                : null
            }
          >
            <CellAction
              column={column}
              dataRow={dataRow}
              handleCellAction={cellActionHandler}
              allowActions={allowActions}
            >
              <div>
                <LinkButton
                  disabled={!target || isEmptyObject(target)}
                  to={target || {}}
                  size="xs"
                >
                  <IconProfiling size="xs" />
                </LinkButton>
              </div>
            </CellAction>
          </Tooltip>
        );
      }

      const fieldName = getAggregateAlias(field);
      const value = dataRow[fieldName];
      if (
        tableMeta[fieldName] === 'integer' &&
        typeof value === 'number' &&
        value > 999
      ) {
        return (
          <Tooltip
            title={value.toLocaleString()}
            containerDisplayMode="block"
            position="right"
          >
            <CellAction
              column={column}
              dataRow={dataRow}
              handleCellAction={cellActionHandler}
              allowActions={allowActions}
            >
              {rendered}
            </CellAction>
          </Tooltip>
        );
      }

      return (
        <CellAction
          column={column}
          dataRow={dataRow}
          handleCellAction={cellActionHandler}
          allowActions={allowActions}
        >
          {rendered}
        </CellAction>
      );
    },
    [
      organization,
      location,
      eventView,
      theme,
      projectSlug,
      transactionName,
      issueId,
      isRegressionIssue,
      domainViewFilters,
      replayLinkGenerator,
      handleCellAction,
    ]
  );

  const renderBodyCellWithData = useCallback(
    (tableData: TableData | null) => {
      return (
        column: TableColumn<keyof TableDataRow>,
        dataRow: TableDataRow
      ): React.ReactNode => renderBodyCell(tableData, column, dataRow);
    },
    [renderBodyCell]
  );

  const onSortClick = useCallback(
    (currentSortKind?: string, currentSortField?: string) => {
      trackAnalytics('performance_views.transactionEvents.sort', {
        organization,
        field: currentSortField,
        direction: currentSortKind,
      });
    },
    [organization]
  );

  const renderHeadCell = useCallback(
    (
      tableMeta: TableData['meta'],
      column: TableColumn<keyof TableDataRow>,
      title: React.ReactNode
    ): React.ReactNode => {
      const align = fieldAlignment(column.name, column.type, tableMeta);
      const field = {field: column.name, width: column.width};

      function generateSortLink(): LocationDescriptorObject | undefined {
        if (!tableMeta) {
          return undefined;
        }

        const nextEventView = eventView.sortOnField(field, tableMeta);
        const queryStringObject = nextEventView.generateQueryStringObject();

        return {
          ...location,
          query: {...location.query, sort: queryStringObject.sort},
        };
      }
      const currentSort = eventView.sortForField(field, tableMeta);
      const canSort =
        field.field !== 'id' &&
        field.field !== 'trace' &&
        field.field !== 'replayId' &&
        field.field !== SPAN_OP_RELATIVE_BREAKDOWN_FIELD &&
        isFieldSortable(field, tableMeta);

      const currentSortKind = currentSort ? currentSort.kind : undefined;
      const currentSortField = currentSort ? currentSort.field : undefined;

      if (field.field === SPAN_OP_RELATIVE_BREAKDOWN_FIELD) {
        title = (
          <OperationSort
            title={OperationTitle}
            eventView={eventView}
            tableMeta={tableMeta}
            location={location}
          />
        );
      }

      const sortLink = (
        <SortLink
          align={align}
          title={title || field.field}
          direction={currentSortKind}
          canSort={canSort}
          generateSortLink={generateSortLink}
          onClick={() => onSortClick(currentSortKind, currentSortField)}
        />
      );
      return sortLink;
    },
    [eventView, location, onSortClick]
  );

  const renderHeadCellWithMeta = useCallback(
    (tableMeta: TableData['meta']) => {
      const columnTitles = initialColumnTitles ?? COLUMN_TITLES;
      return (column: TableColumn<keyof TableDataRow>, index: number): React.ReactNode =>
        renderHeadCell(tableMeta, column, columnTitles[index]);
    },
    [renderHeadCell, initialColumnTitles]
  );

  const joinCustomData = useCallback(
    (tableData: TableData | null) => {
      if (!tableData?.data) {
        return;
      }
      const attachmentsByEvent = groupBy(attachments, 'event_id');
      tableData.data.forEach(event => {
        event.attachments = (attachmentsByEvent[event.id] || []) as any;
      });
    },
    [attachments]
  );

  const fetchAttachments = useCallback(
    async (tableData: TableData, cursor: string) => {
      const eventIds = tableData.data.map(value => value.id);
      const fetchOnlyMinidumps = !customColumns?.includes('attachments');

      const queries: string = [
        'per_page=50',
        ...(fetchOnlyMinidumps ? ['types=event.minidump'] : []),
        ...eventIds.map(eventId => `event_id=${eventId}`),
      ].join('&');

      const res: IssueAttachment[] = await api.requestPromise(
        `/api/0/issues/${issueId}/attachments/?${queries}`
      );

      let newHasMinidumps = false;

      res.forEach(attachment => {
        if (attachment.type === 'event.minidump') {
          newHasMinidumps = true;
        }
      });

      setLastFetchedCursor(cursor);
      setAttachments(res);
      setHasMinidumps(newHasMinidumps);
    },
    [api, customColumns, issueId]
  );

  const totalEventsView = eventView.clone();
  totalEventsView.sorts = [];
  totalEventsView.fields = [{field: 'count()', width: -1}];

  const containsSpanOpsBreakdown = eventView
    .getColumns()
    .some(
      (col: TableColumn<string | number>) => col.name === SPAN_OP_RELATIVE_BREAKDOWN_FIELD
    );

  const {columns, handleResizeColumn} = useStateBasedColumnResize({
    columns: eventView.getColumns(),
  });

  const columnOrder = columns.filter((col: TableColumn<string | number>) =>
    shouldRenderColumn(containsSpanOpsBreakdown, col.name)
  );

  if (customColumns?.includes('attachments') && attachments.length) {
    columnOrder.push({
      isSortable: false,
      key: 'attachments',
      name: 'attachments',
      type: 'never',
      column: {field: 'attachments', kind: 'field', alias: undefined},
    });
  }

  if (customColumns?.includes('minidump') && hasMinidumps) {
    columnOrder.push({
      isSortable: false,
      key: 'minidump',
      name: 'minidump',
      type: 'never',
      column: {field: 'minidump', kind: 'field', alias: undefined},
    });
  }

  return (
    <div data-test-id="events-table">
      <DiscoverQuery
        eventView={totalEventsView}
        orgSlug={organization.slug}
        location={location}
        setError={error => setError(error?.message)}
        referrer="api.insights.transaction-summary"
        cursor="0:0:0"
      >
        {({isLoading: isTotalEventsLoading, tableData: table}) => {
          const totalEventsCount = table?.data[0]?.['count()'] ?? 0;

          return (
            <DiscoverQuery
              eventView={eventView}
              orgSlug={organization.slug}
              location={location}
              setError={error => setError(error?.message)}
              referrer={referrer || 'api.insights.transaction-events'}
            >
              {({pageLinks, isLoading: isDiscoverQueryLoading, tableData}) => {
                tableData ??= {data: []};
                const pageEventsCount = tableData?.data?.length ?? 0;
                const parsedPageLinks = parseLinkHeader(pageLinks);
                const cursor = parsedPageLinks?.next?.cursor;
                const shouldFetchAttachments: boolean =
                  organization.features.includes('event-attachments') &&
                  !!issueId &&
                  !!cursor &&
                  lastFetchedCursor !== cursor; // Only fetch on issue details page

                const paginationCaption =
                  totalEventsCount && pageEventsCount
                    ? tct('Showing [pageEventsCount] of [totalEventsCount] events', {
                        pageEventsCount: pageEventsCount.toLocaleString(),
                        totalEventsCount: totalEventsCount.toLocaleString(),
                      })
                    : undefined;
                if (cursor && shouldFetchAttachments) {
                  fetchAttachments(tableData, cursor);
                }
                joinCustomData(tableData);
                return (
                  <Fragment>
                    <VisuallyCompleteWithData
                      id="TransactionEvents-EventsTable"
                      hasData={!!tableData?.data?.length}
                    >
                      {renderTableHeader
                        ? renderTableHeader({
                            isPending: isDiscoverQueryLoading,
                            pageLinks,
                            pageEventsCount,
                            totalEventsCount,
                          })
                        : null}
                      <GridEditable
                        isLoading={
                          isTotalEventsLoading ||
                          isDiscoverQueryLoading ||
                          shouldFetchAttachments ||
                          isEventLoading
                        }
                        data={tableData?.data ?? []}
                        columnOrder={columnOrder}
                        columnSortBy={eventView.getSorts()}
                        grid={{
                          onResizeColumn: handleResizeColumn,
                          renderHeadCell: renderHeadCellWithMeta(tableData?.meta) as any,
                          renderBodyCell: renderBodyCellWithData(tableData) as any,
                        }}
                      />
                    </VisuallyCompleteWithData>
                    {hidePagination ? null : (
                      <Pagination
                        disabled={isDiscoverQueryLoading}
                        caption={paginationCaption}
                        pageLinks={pageLinks}
                      />
                    )}
                  </Fragment>
                );
              }}
            </DiscoverQuery>
          );
        }}
      </DiscoverQuery>
    </div>
  );
}

const StyledIconQuestion = styled(QuestionTooltip)`
  position: relative;
  top: 1px;
  left: 4px;
`;
