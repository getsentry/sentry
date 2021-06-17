import * as React from 'react';
import * as ReactRouter from 'react-router';
import styled from '@emotion/styled';
import {Location, LocationDescriptorObject} from 'history';

import {fetchLegacyKeyTransactionsCount} from 'app/actionCreators/performance';
import GuideAnchor from 'app/components/assistant/guideAnchor';
import GridEditable, {COL_WIDTH_UNDEFINED, GridColumn} from 'app/components/gridEditable';
import SortLink from 'app/components/gridEditable/sortLink';
import Link from 'app/components/links/link';
import Pagination from 'app/components/pagination';
import Tooltip from 'app/components/tooltip';
import {IconQuestion, IconStar} from 'app/icons';
import {t} from 'app/locale';
import {Organization, Project} from 'app/types';
import {defined} from 'app/utils';
import {trackAnalyticsEvent} from 'app/utils/analytics';
import DiscoverQuery, {TableData, TableDataRow} from 'app/utils/discover/discoverQuery';
import EventView, {EventData, isFieldSortable} from 'app/utils/discover/eventView';
import {getFieldRenderer} from 'app/utils/discover/fieldRenderers';
import {
  fieldAlignment,
  getAggregateAlias,
  SPAN_OP_BREAKDOWN_FIELDS,
} from 'app/utils/discover/fields';
import {stringifyQueryObject, tokenizeSearch} from 'app/utils/tokenizeSearch';
import CellAction, {Actions, updateQuery} from 'app/views/eventsV2/table/cellAction';
import {TableColumn} from 'app/views/eventsV2/table/types';

import OperationSort, {
  TitleProps,
} from './transactionSummary/transactionEvents/operationSort';
import {
  generateTraceLink,
  generateTransactionLink,
  transactionSummaryRouteWithQuery,
} from './transactionSummary/utils';
import {COLUMN_TITLES} from './data';

export function getProjectID(
  eventData: EventData,
  projects: Project[]
): string | undefined {
  const projectSlug = (eventData?.project as string) || undefined;

  if (typeof projectSlug === undefined) {
    return undefined;
  }

  const project = projects.find(currentProject => currentProject.slug === projectSlug);

  if (!project) {
    return undefined;
  }

  return project.id;
}

class OperationTitle extends React.Component<TitleProps> {
  render() {
    const {onClick} = this.props;
    return (
      <div onClick={onClick}>
        <span>{t('operation duration')}</span>
        <Tooltip
          title={t(
            'Durations are calculated by summing span durations over the course of the transaction. Percentages are then calculated by dividing the individual op duration by the sum of total op durations. Overlapping/parallel spans are only counted once.'
          )}
        >
          <StyledIconQuestion size="xs" color="gray400" />
        </Tooltip>
      </div>
    );
  }
}

type Props = {
  eventView: EventView;
  organization: Organization;
  location: Location;
  setError: (msg: string | undefined) => void;
  summaryConditions: string;

  projects: Project[];
  columnTitles?: string[];
};

type State = {
  widths: number[];
  keyedTransactions: number | null;
};
class Table extends React.Component<Props, State> {
  state: State = {
    widths: [],
    keyedTransactions: null,
  };

  componentDidMount() {
    this.fetchKeyTransactionCount();
  }

  async fetchKeyTransactionCount() {
    const {organization} = this.props;
    try {
      const count = await fetchLegacyKeyTransactionsCount(organization.slug);
      this.setState({keyedTransactions: count});
    } catch (error) {
      this.setState({keyedTransactions: null});
    }
  }

  handleCellAction = (column: TableColumn<keyof TableDataRow>) => {
    return (action: Actions, value: React.ReactText) => {
      const {eventView, location, organization} = this.props;

      trackAnalyticsEvent({
        eventKey: 'performance_views.overview.cellaction',
        eventName: 'Performance Views: Cell Action Clicked',
        organization_id: parseInt(organization.id, 10),
        action,
      });

      const searchConditions = tokenizeSearch(eventView.query);

      // remove any event.type queries since it is implied to apply to only transactions
      searchConditions.removeTag('event.type');

      updateQuery(searchConditions, action, column, value);

      ReactRouter.browserHistory.push({
        pathname: location.pathname,
        query: {
          ...location.query,
          cursor: undefined,
          query: stringifyQueryObject(searchConditions),
        },
      });
    };
  };

  renderBodyCell(
    tableData: TableData | null,
    column: TableColumn<keyof TableDataRow>,
    dataRow: TableDataRow
  ): React.ReactNode {
    const {eventView, organization, projects, location} = this.props;

    if (!tableData || !tableData.meta) {
      return dataRow[column.key];
    }
    const tableMeta = tableData.meta;
    // Attach sort to the metadata if sorting by a span operation. This is so fieldRenderer will know which breakdown to display first.
    if (
      location.query.sort &&
      typeof location.query.sort === 'string' &&
      SPAN_OP_BREAKDOWN_FIELDS.includes(location.query.sort.replace(/^-/, ''))
    ) {
      dataRow.sortedBy = location.query.sort.replace(/^-/, '');
    }
    const field = String(column.key);
    const fieldRenderer = getFieldRenderer(field, tableMeta);
    const rendered = fieldRenderer(dataRow, {organization, location});

    const allowActions = [
      Actions.ADD,
      Actions.EXCLUDE,
      Actions.SHOW_GREATER_THAN,
      Actions.SHOW_LESS_THAN,
    ];

    if (field === 'transaction') {
      const projectID = getProjectID(dataRow, projects);
      const summaryView = eventView.clone();
      if (dataRow['http.method']) {
        summaryView.additionalConditions.setTagValues('http.method', [
          dataRow['http.method'] as string,
        ]);
      }
      summaryView.query = summaryView.getQueryWithAdditionalConditions();
      const target = transactionSummaryRouteWithQuery({
        orgSlug: organization.slug,
        transaction: String(dataRow.transaction) || '',
        query: summaryView.generateQueryStringObject(),
        projectID,
      });

      return (
        <CellAction
          column={column}
          dataRow={dataRow}
          handleCellAction={this.handleCellAction(column)}
          allowActions={allowActions}
        >
          <Link to={target} onClick={this.handleSummaryClick}>
            {rendered}
          </Link>
        </CellAction>
      );
    }

    if (field === 'id') {
      const target = generateTransactionLink(eventView.name as string)(
        organization,
        dataRow,
        location.query
      );

      return (
        <CellAction
          column={column}
          dataRow={dataRow}
          handleCellAction={this.handleCellAction(column)}
          allowActions={allowActions}
        >
          <Link to={target} onClick={this.handleSummaryClick}>
            {rendered}
          </Link>
        </CellAction>
      );
    }

    if (field === 'trace') {
      const target = generateTraceLink(eventView.name as string)(
        organization,
        dataRow,
        location.query
      );

      return (
        <CellAction
          column={column}
          dataRow={dataRow}
          handleCellAction={this.handleCellAction(column)}
          allowActions={allowActions}
        >
          <Link to={target} onClick={this.handleSummaryClick}>
            {rendered}
          </Link>
        </CellAction>
      );
    }

    if (field.startsWith('key_transaction')) {
      // don't display per cell actions for key_transaction
      return rendered;
    }

    if (field.startsWith('team_key_transaction')) {
      // don't display per cell actions for team_key_transaction
      return rendered;
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
    trackAnalyticsEvent({
      eventKey: 'performance_views.landingv2.transactions.sort',
      eventName: 'Performance Views: Landing Transactions Sorted',
      organization_id: parseInt(organization.id, 10),
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
    // Event id and Trace id are technically sortable but we don't want to sort them here since sorting by a uuid value doesn't make sense
    const canSort =
      field.field !== 'id' &&
      field.field !== 'trace' &&
      field.field !== 'span_ops_breakdown.relative' &&
      isFieldSortable(field, tableMeta);

    const currentSortKind = currentSort ? currentSort.kind : undefined;
    const currentSortField = currentSort ? currentSort.field : undefined;

    if (field.field === 'span_ops_breakdown.relative') {
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
    if (field.field.startsWith('user_misery')) {
      return (
        <GuideAnchor target="user_misery" position="top">
          {sortLink}
        </GuideAnchor>
      );
    }
    return sortLink;
  }

  renderHeadCellWithMeta = (tableMeta: TableData['meta']) => {
    const columnTitles = this.props.columnTitles ?? COLUMN_TITLES;
    return (column: TableColumn<keyof TableDataRow>, index: number): React.ReactNode =>
      this.renderHeadCell(tableMeta, column, columnTitles[index]);
  };

  renderPrependCellWithData = (tableData: TableData | null) => {
    const {eventView} = this.props;
    const {keyedTransactions} = this.state;

    const keyTransactionColumn = eventView
      .getColumns()
      .find((col: TableColumn<React.ReactText>) => col.name === 'key_transaction');
    const teamKeyTransactionColumn = eventView
      .getColumns()
      .find((col: TableColumn<React.ReactText>) => col.name === 'team_key_transaction');
    return (isHeader: boolean, dataRow?: any) => {
      if (keyTransactionColumn) {
        if (isHeader) {
          const star = (
            <IconStar
              key="keyTransaction"
              color="yellow300"
              isSolid
              data-test-id="key-transaction-header"
            />
          );
          return [this.renderHeadCell(tableData?.meta, keyTransactionColumn, star)];
        } else {
          return [this.renderBodyCell(tableData, keyTransactionColumn, dataRow)];
        }
      } else if (teamKeyTransactionColumn) {
        if (isHeader) {
          const star = (
            <GuideAnchor
              target="team_key_transaction_header"
              position="top"
              disabled={keyedTransactions === null} // wait for the legacy counts to load
            >
              <GuideAnchor
                target="team_key_transaction_existing"
                position="top"
                disabled={!keyedTransactions}
              >
                <IconStar
                  key="keyTransaction"
                  color="yellow300"
                  isSolid
                  data-test-id="team-key-transaction-header"
                />
              </GuideAnchor>
            </GuideAnchor>
          );
          return [this.renderHeadCell(tableData?.meta, teamKeyTransactionColumn, star)];
        } else {
          return [this.renderBodyCell(tableData, teamKeyTransactionColumn, dataRow)];
        }
      }
      return undefined;
    };
  };

  handleSummaryClick = () => {
    const {organization} = this.props;
    trackAnalyticsEvent({
      eventKey: 'performance_views.overview.navigate.summary',
      eventName: 'Performance Views: Overview view summary',
      organization_id: parseInt(organization.id, 10),
    });
  };

  handleResizeColumn = (columnIndex: number, nextColumn: GridColumn) => {
    const widths: number[] = [...this.state.widths];
    widths[columnIndex] = nextColumn.width
      ? Number(nextColumn.width)
      : COL_WIDTH_UNDEFINED;
    this.setState({widths});
  };

  getSortedEventView() {
    const {eventView, organization} = this.props;

    return eventView.withSorts([
      {
        field: organization.features.includes('team-key-transactions')
          ? 'team_key_transaction'
          : 'key_transaction',
        kind: 'desc',
      },
      ...eventView.sorts,
    ]);
  }

  render() {
    const {eventView, organization, location, setError} = this.props;

    const {widths} = this.state;
    const containsSpanOpsBreakdown = eventView
      .getColumns()
      .find(
        (col: TableColumn<React.ReactText>) => col.name === 'span_ops_breakdown.relative'
      );
    const columnOrder = eventView
      .getColumns()
      // remove key_transactions from the column order as we'll be rendering it
      // via a prepended column
      // also remove spans if span_ops_breakdown is a column
      .filter(
        (col: TableColumn<React.ReactText>) =>
          col.name !== 'key_transaction' &&
          col.name !== 'team_key_transaction' &&
          !col.name.startsWith('count_miserable') &&
          col.name !== 'project_threshold_config' &&
          (!containsSpanOpsBreakdown || !col.name.startsWith('spans'))
      )
      .map((col: TableColumn<React.ReactText>, i: number) => {
        if (typeof widths[i] === 'number') {
          return {...col, width: widths[i]};
        }
        return col;
      });

    const sortedEventView = this.getSortedEventView();
    const columnSortBy = sortedEventView.getSorts();

    const containsKeyTransactionColumn = !!(
      eventView
        .getColumns()
        .find((col: TableColumn<React.ReactText>) => col.name === 'key_transaction') ||
      eventView
        .getColumns()
        .find((col: TableColumn<React.ReactText>) => col.name === 'team_key_transaction')
    );
    const prependColumnWidths = containsKeyTransactionColumn
      ? ['max-content']
      : undefined;

    return (
      <div>
        <DiscoverQuery
          eventView={sortedEventView}
          orgSlug={organization.slug}
          location={location}
          setError={setError}
          referrer="api.performance.landing-table"
        >
          {({pageLinks, isLoading, tableData}) => {
            return (
              <React.Fragment>
                <GridEditable
                  isLoading={isLoading}
                  data={tableData ? tableData.data : []}
                  columnOrder={columnOrder}
                  columnSortBy={columnSortBy}
                  grid={{
                    onResizeColumn: this.handleResizeColumn,
                    renderHeadCell: this.renderHeadCellWithMeta(tableData?.meta) as any,
                    renderBodyCell: this.renderBodyCellWithData(tableData) as any,
                    renderPrependColumns: containsKeyTransactionColumn
                      ? (this.renderPrependCellWithData(tableData) as any)
                      : undefined,
                    prependColumnWidths,
                  }}
                  location={location}
                />
                <Pagination pageLinks={pageLinks} />
              </React.Fragment>
            );
          }}
        </DiscoverQuery>
      </div>
    );
  }
}

const StyledIconQuestion = styled(IconQuestion)`
  position: relative;
  top: 2px;
  left: 4px;
`;

export default Table;
