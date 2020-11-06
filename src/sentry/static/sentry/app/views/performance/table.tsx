import React from 'react';
import {Location, LocationDescriptorObject} from 'history';
import * as ReactRouter from 'react-router';

import {IconStar} from 'app/icons';
import {Organization, Project} from 'app/types';
import Pagination from 'app/components/pagination';
import Link from 'app/components/links/link';
import EventView, {EventData, isFieldSortable} from 'app/utils/discover/eventView';
import {TableColumn} from 'app/views/eventsV2/table/types';
import GridEditable, {COL_WIDTH_UNDEFINED, GridColumn} from 'app/components/gridEditable';
import SortLink from 'app/components/gridEditable/sortLink';
import HeaderCell from 'app/views/eventsV2/table/headerCell';
import CellAction, {Actions, updateQuery} from 'app/views/eventsV2/table/cellAction';
import {trackAnalyticsEvent} from 'app/utils/analytics';
import {getFieldRenderer} from 'app/utils/discover/fieldRenderers';
import {tokenizeSearch, stringifyQueryObject} from 'app/utils/tokenizeSearch';
import DiscoverQuery, {TableData, TableDataRow} from 'app/utils/discover/discoverQuery';

import {transactionSummaryRouteWithQuery} from './transactionSummary/utils';
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

type Props = {
  eventView: EventView;
  organization: Organization;
  location: Location;
  setError: (msg: string | undefined) => void;
  keyTransactions: boolean;
  summaryConditions: string;

  projects: Project[];
};

type State = {
  widths: number[];
};

class Table extends React.Component<Props, State> {
  state = {
    widths: [],
  };

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

      updateQuery(searchConditions, action, column.name, value);

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
    const {eventView, organization, projects, location, summaryConditions} = this.props;

    if (!tableData || !tableData.meta) {
      return dataRow[column.key];
    }
    const tableMeta = tableData.meta;

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
      summaryView.query = summaryConditions;

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

    if (field.startsWith('key_transaction') || field.startsWith('user_misery')) {
      // don't display per cell actions for key_transaction or user_misery
      return rendered;
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

  renderHeadCell(
    tableMeta: TableData['meta'],
    column: TableColumn<keyof TableDataRow>,
    title: React.ReactNode
  ): React.ReactNode {
    const {eventView, location} = this.props;

    return (
      <HeaderCell column={column} tableMeta={tableMeta}>
        {({align}) => {
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
          const canSort = isFieldSortable(field, tableMeta);

          return (
            <SortLink
              align={align}
              title={title || field.field}
              direction={currentSort ? currentSort.kind : undefined}
              canSort={canSort}
              generateSortLink={generateSortLink}
            />
          );
        }}
      </HeaderCell>
    );
  }

  renderHeadCellWithMeta = (tableMeta: TableData['meta']) => {
    return (column: TableColumn<keyof TableDataRow>, index: number): React.ReactNode =>
      this.renderHeadCell(tableMeta, column, COLUMN_TITLES[index]);
  };

  renderPrependCellWithData = (tableData: TableData | null) => {
    const {eventView} = this.props;
    const keyTransactionColumn = eventView
      .getColumns()
      .find((col: TableColumn<React.ReactText>) => col.name === 'key_transaction');
    return (isHeader: boolean, dataRow?: any) => {
      if (!keyTransactionColumn) {
        return [];
      }

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
    const {eventView} = this.props;

    // We special case sort by key transactions here to include
    // the transaction name and project as the secondary sorts.
    const keyTransactionSort = eventView.sorts.find(
      sort => sort.field === 'key_transaction'
    );
    if (keyTransactionSort) {
      const sorts = ['key_transaction', 'transaction', 'project'].map(field => ({
        field,
        kind: keyTransactionSort.kind,
      }));
      return eventView.withSorts(sorts);
    }

    return eventView;
  }

  render() {
    const {eventView, organization, location, keyTransactions} = this.props;
    const {widths} = this.state;
    const columnOrder = eventView
      .getColumns()
      // remove key_transactions from the column order as we'll be rendering it
      // via a prepended column
      .filter((col: TableColumn<React.ReactText>) => col.name !== 'key_transaction')
      .map((col: TableColumn<React.ReactText>, i: number) => {
        if (typeof widths[i] === 'number') {
          return {...col, width: widths[i]};
        }
        return col;
      });

    const sortedEventView = this.getSortedEventView();
    const columnSortBy = sortedEventView.getSorts();

    const prependColumnWidths = organization.features.includes('key-transactions')
      ? ['max-content']
      : [];

    return (
      <div>
        <DiscoverQuery
          eventView={sortedEventView}
          orgSlug={organization.slug}
          location={location}
          keyTransactions={keyTransactions}
        >
          {({pageLinks, isLoading, tableData}) => (
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
                  renderPrependColumns: this.renderPrependCellWithData(tableData) as any,
                  prependColumnWidths,
                }}
                location={location}
              />
              <Pagination pageLinks={pageLinks} />
            </React.Fragment>
          )}
        </DiscoverQuery>
      </div>
    );
  }
}

export default Table;
