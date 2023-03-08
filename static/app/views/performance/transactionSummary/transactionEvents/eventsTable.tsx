import {Component} from 'react';
import {browserHistory, RouteContextInterface} from 'react-router';
import styled from '@emotion/styled';
import {Location, LocationDescriptor, LocationDescriptorObject} from 'history';
import groupBy from 'lodash/groupBy';

import {Client} from 'sentry/api';
import GridEditable, {
  COL_WIDTH_UNDEFINED,
  GridColumn,
} from 'sentry/components/gridEditable';
import SortLink from 'sentry/components/gridEditable/sortLink';
import Link from 'sentry/components/links/link';
import Pagination from 'sentry/components/pagination';
import QuestionTooltip from 'sentry/components/questionTooltip';
import ReplayIdCountProvider from 'sentry/components/replays/replayIdCountProvider';
import {Tooltip} from 'sentry/components/tooltip';
import {t, tct} from 'sentry/locale';
import {IssueAttachment, Organization} from 'sentry/types';
import {defined} from 'sentry/utils';
import trackAdvancedAnalyticsEvent from 'sentry/utils/analytics/trackAdvancedAnalyticsEvent';
import DiscoverQuery, {
  TableData,
  TableDataRow,
} from 'sentry/utils/discover/discoverQuery';
import EventView, {isFieldSortable} from 'sentry/utils/discover/eventView';
import {getFieldRenderer} from 'sentry/utils/discover/fieldRenderers';
import {
  fieldAlignment,
  getAggregateAlias,
  isSpanOperationBreakdownField,
  SPAN_OP_RELATIVE_BREAKDOWN_FIELD,
} from 'sentry/utils/discover/fields';
import ViewReplayLink from 'sentry/utils/discover/viewReplayLink';
import parseLinkHeader from 'sentry/utils/parseLinkHeader';
import CellAction, {Actions, updateQuery} from 'sentry/views/discover/table/cellAction';
import {TableColumn} from 'sentry/views/discover/table/types';

import {COLUMN_TITLES} from '../../data';
import {
  generateProfileLink,
  generateReplayLink,
  generateTraceLink,
  generateTransactionLink,
  normalizeSearchConditions,
} from '../utils';

import OperationSort, {TitleProps} from './operationSort';

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
  transactionName: string;
  columnTitles?: string[];
  customColumns?: ('attachments' | 'minidump')[];
  excludedTags?: string[];
  issueId?: string;
  projectSlug?: string;
  referrer?: string;
};

type State = {
  attachments: IssueAttachment[];
  hasMinidumps: boolean;
  lastFetchedCursor: string;
  widths: number[];
};

class EventsTable extends Component<Props, State> {
  state: State = {
    widths: [],
    lastFetchedCursor: '',
    attachments: [],
    hasMinidumps: false,
  };

  api = new Client();
  replayLinkGenerator = generateReplayLink(this.props.routes);

  handleCellAction = (column: TableColumn<keyof TableDataRow>) => {
    return (action: Actions, value: React.ReactText) => {
      const {eventView, location, organization, excludedTags} = this.props;

      trackAdvancedAnalyticsEvent('performance_views.transactionEvents.cellaction', {
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

      browserHistory.push({
        pathname: location.pathname,
        query: {
          ...location.query,
          cursor: undefined,
          query: searchConditions.formatString(),
        },
      });
    };
  };

  renderBodyCell(
    tableData: TableData | null,
    column: TableColumn<keyof TableDataRow>,
    dataRow: TableDataRow
  ): React.ReactNode {
    const {eventView, organization, location, transactionName, projectSlug} = this.props;

    if (!tableData || !tableData.meta) {
      return dataRow[column.key];
    }
    const tableMeta = tableData.meta;
    const field = String(column.key);
    const fieldRenderer = getFieldRenderer(field, tableMeta);
    const rendered = fieldRenderer(dataRow, {
      organization,
      location,
      eventView,
      projectSlug,
    });

    const allowActions = [
      Actions.ADD,
      Actions.EXCLUDE,
      Actions.SHOW_GREATER_THAN,
      Actions.SHOW_LESS_THAN,
    ];

    if (['attachments', 'minidump'].includes(field)) {
      return rendered;
    }

    if (field === 'id' || field === 'trace') {
      const {issueId} = this.props;
      const isIssue: boolean = !!issueId;
      let target: LocationDescriptor = {};
      // TODO: set referrer properly
      if (isIssue && field === 'id') {
        target.pathname = `/organizations/${organization.slug}/issues/${issueId}/events/${dataRow.id}/`;
      } else {
        const generateLink = field === 'id' ? generateTransactionLink : generateTraceLink;
        target = generateLink(transactionName)(organization, dataRow, location.query);
      }

      return (
        <CellAction
          column={column}
          dataRow={dataRow}
          handleCellAction={this.handleCellAction(column)}
          allowActions={allowActions}
        >
          <Link to={target}>{rendered}</Link>
        </CellAction>
      );
    }

    if (field === 'replayId') {
      const target: LocationDescriptor | null = dataRow.replayId
        ? this.replayLinkGenerator(organization, dataRow, undefined)
        : null;

      return (
        <CellAction
          column={column}
          dataRow={dataRow}
          handleCellAction={this.handleCellAction(column)}
          allowActions={allowActions}
        >
          {target ? (
            <ViewReplayLink replayId={dataRow.replayId} to={target}>
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
      return (
        <CellAction
          column={column}
          dataRow={dataRow}
          handleCellAction={this.handleCellAction(column)}
          allowActions={allowActions}
        >
          {target ? <Link to={target}>{rendered}</Link> : rendered}
        </CellAction>
      );
    }

    const fieldName = getAggregateAlias(field);
    const value = dataRow[fieldName];
    if (tableMeta[fieldName] === 'integer' && defined(value) && value > 999) {
      return (
        <Tooltip
          title={value.toLocaleString()}
          containerDisplayMode="block"
          position="right"
        >
          <CellAction
            column={column}
            dataRow={dataRow}
            handleCellAction={this.handleCellAction(column)}
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
        handleCellAction={this.handleCellAction(column)}
        allowActions={allowActions}
      >
        {rendered}
      </CellAction>
    );
  }

  renderBodyCellWithData = (tableData: TableData | null) => {
    return (
      column: TableColumn<keyof TableDataRow>,
      dataRow: TableDataRow
    ): React.ReactNode => this.renderBodyCell(tableData, column, dataRow);
  };

  onSortClick(currentSortKind?: string, currentSortField?: string) {
    const {organization} = this.props;
    trackAdvancedAnalyticsEvent('performance_views.transactionEvents.sort', {
      organization,
      field: currentSortField,
      direction: currentSortKind,
    });
  }

  renderHeadCell(
    tableMeta: TableData['meta'],
    column: TableColumn<keyof TableDataRow>,
    title: React.ReactNode
  ): React.ReactNode {
    const {eventView, location} = this.props;

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
    // EventId, TraceId, and ReplayId are technically sortable but we don't want to sort them here since sorting by a uuid value doesn't make sense
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
        onClick={() => this.onSortClick(currentSortKind, currentSortField)}
      />
    );
    return sortLink;
  }

  renderHeadCellWithMeta = (tableMeta: TableData['meta']) => {
    const columnTitles = this.props.columnTitles ?? COLUMN_TITLES;
    return (column: TableColumn<keyof TableDataRow>, index: number): React.ReactNode =>
      this.renderHeadCell(tableMeta, column, columnTitles[index]);
  };

  handleResizeColumn = (columnIndex: number, nextColumn: GridColumn) => {
    const widths: number[] = [...this.state.widths];
    widths[columnIndex] = nextColumn.width
      ? Number(nextColumn.width)
      : COL_WIDTH_UNDEFINED;
    this.setState({...this.state, widths});
  };

  render() {
    const {eventView, organization, location, setError, referrer} = this.props;

    const totalEventsView = eventView.clone();
    totalEventsView.sorts = [];
    totalEventsView.fields = [{field: 'count()', width: -1}];

    const {widths} = this.state;
    const containsSpanOpsBreakdown = eventView
      .getColumns()
      .find(
        (col: TableColumn<React.ReactText>) =>
          col.name === SPAN_OP_RELATIVE_BREAKDOWN_FIELD
      );

    const columnOrder = eventView
      .getColumns()
      .filter(
        (col: TableColumn<React.ReactText>) =>
          !containsSpanOpsBreakdown || !isSpanOperationBreakdownField(col.name)
      )
      .map((col: TableColumn<React.ReactText>, i: number) => {
        if (typeof widths[i] === 'number') {
          return {...col, width: widths[i]};
        }
        return col;
      });

    if (
      this.props.customColumns?.includes('attachments') &&
      this.state.attachments.length
    ) {
      columnOrder.push({
        isSortable: false,
        key: 'attachments',
        name: 'attachments',
        type: 'never',
        column: {field: 'attachments', kind: 'field', alias: undefined},
      });
    }

    if (this.props.customColumns?.includes('minidump') && this.state.hasMinidumps) {
      columnOrder.push({
        isSortable: false,
        key: 'minidump',
        name: 'minidump',
        type: 'never',
        column: {field: 'minidump', kind: 'field', alias: undefined},
      });
    }

    const joinCustomData = ({data}: TableData) => {
      const attachmentsByEvent = groupBy(this.state.attachments, 'event_id');
      data.forEach(event => {
        event.attachments = (attachmentsByEvent[event.id] || []) as any;
      });
    };

    const fetchAttachments = async ({data}: TableData, cursor: string) => {
      const eventIds = data.map(value => value.id);
      const fetchOnlyMinidumps = !this.props.customColumns?.includes('attachments');

      const queries: string = [
        'per_page=50',
        ...(fetchOnlyMinidumps ? ['types=event.minidump'] : []),
        ...eventIds.map(eventId => `event_id=${eventId}`),
      ].join('&');

      const res: IssueAttachment[] = await this.api.requestPromise(
        `/api/0/issues/${this.props.issueId}/attachments/?${queries}`
      );

      let hasMinidumps = false;

      res.forEach(attachment => {
        if (attachment.type === 'event.minidump') {
          hasMinidumps = true;
        }
      });

      this.setState({
        ...this.state,
        lastFetchedCursor: cursor,
        attachments: res,
        hasMinidumps,
      });
    };

    return (
      <div data-test-id="events-table">
        <DiscoverQuery
          eventView={totalEventsView}
          orgSlug={organization.slug}
          location={location}
          setError={error => setError(error?.message)}
          referrer="api.performance.transaction-summary"
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
                referrer={referrer || 'api.performance.transaction-events'}
              >
                {({pageLinks, isLoading: isDiscoverQueryLoading, tableData}) => {
                  tableData ??= {data: []};
                  const pageEventsCount = tableData?.data?.length ?? 0;
                  const parsedPageLinks = parseLinkHeader(pageLinks);
                  const cursor = parsedPageLinks?.next?.cursor;
                  const shouldFetchAttachments: boolean =
                    organization.features.includes('event-attachments') &&
                    !!this.props.issueId &&
                    !!cursor &&
                    this.state.lastFetchedCursor !== cursor; // Only fetch on issue details page

                  const paginationCaption =
                    totalEventsCount && pageEventsCount
                      ? tct('Showing [pageEventsCount] of [totalEventsCount] events', {
                          pageEventsCount: pageEventsCount.toLocaleString(),
                          totalEventsCount: totalEventsCount.toLocaleString(),
                        })
                      : undefined;
                  if (shouldFetchAttachments) {
                    fetchAttachments(tableData, cursor);
                  }
                  joinCustomData(tableData);
                  const replayIds = tableData.data.map(row => row.replayId);
                  return (
                    <ReplayIdCountProvider
                      organization={organization}
                      replayIds={replayIds}
                    >
                      <GridEditable
                        isLoading={
                          isTotalEventsLoading ||
                          isDiscoverQueryLoading ||
                          shouldFetchAttachments
                        }
                        data={tableData?.data ?? []}
                        columnOrder={columnOrder}
                        columnSortBy={eventView.getSorts()}
                        grid={{
                          onResizeColumn: this.handleResizeColumn,
                          renderHeadCell: this.renderHeadCellWithMeta(
                            tableData?.meta
                          ) as any,
                          renderBodyCell: this.renderBodyCellWithData(tableData) as any,
                        }}
                        location={location}
                      />
                      <Pagination
                        disabled={isDiscoverQueryLoading}
                        caption={paginationCaption}
                        pageLinks={pageLinks}
                      />
                    </ReplayIdCountProvider>
                  );
                }}
              </DiscoverQuery>
            );
          }}
        </DiscoverQuery>
      </div>
    );
  }
}

const StyledIconQuestion = styled(QuestionTooltip)`
  position: relative;
  top: 1px;
  left: 4px;
`;

export default EventsTable;
