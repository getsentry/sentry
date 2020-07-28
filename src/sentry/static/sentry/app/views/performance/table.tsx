import React from 'react';
import {Location, LocationDescriptorObject} from 'history';
import * as ReactRouter from 'react-router';

import {Organization, Project} from 'app/types';
import Pagination from 'app/components/pagination';
import Link from 'app/components/links/link';
import EventView, {EventData, isFieldSortable} from 'app/utils/discover/eventView';
import {TableData, TableDataRow, TableColumn} from 'app/views/eventsV2/table/types';
import GridEditable, {COL_WIDTH_UNDEFINED, GridColumn} from 'app/components/gridEditable';
import SortLink from 'app/components/gridEditable/sortLink';
import HeaderCell from 'app/views/eventsV2/table/headerCell';
import CellAction, {Actions} from 'app/views/eventsV2/table/cellAction';
import DiscoverQuery from 'app/utils/discover/discoverQuery';
import {trackAnalyticsEvent} from 'app/utils/analytics';
import {getFieldRenderer} from 'app/utils/discover/fieldRenderers';
import {tokenizeSearch, stringifyQueryObject} from 'app/utils/tokenizeSearch';

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

      let nextLocationQuery: Location['query'] = {};
      const searchConditions = tokenizeSearch(eventView.query);

      // remove any event.type queries since it is implied to apply to only transactions
      searchConditions.removeTag('event.type');

      trackAnalyticsEvent({
        eventKey: 'performance_views.overview.cellaction',
        eventName: 'Performance Views: Cell Action Clicked',
        organization_id: parseInt(organization.id, 10),
        action,
      });

      switch (action) {
        case Actions.ADD: {
          // Remove exclusion if it exists.
          searchConditions.removeTag(`!${column.name}`).setTag(column.name, [`${value}`]);

          nextLocationQuery = {
            query: stringifyQueryObject(searchConditions),
          };

          break;
        }
        case Actions.EXCLUDE: {
          // Remove positive if it exists.
          searchConditions.removeTag(column.name);
          // Negations should stack up.
          const negation = `!${column.name}`;
          searchConditions.addTag(negation, [`${value}`]);

          nextLocationQuery = {
            query: stringifyQueryObject(searchConditions),
          };

          break;
        }
        case Actions.SHOW_GREATER_THAN: {
          // Remove query token if it already exists
          searchConditions.setTag(column.name, [`>${value}`]);

          nextLocationQuery = {
            query: stringifyQueryObject(searchConditions),
          };

          break;
        }
        case Actions.SHOW_LESS_THAN: {
          // Remove query token if it already exists
          searchConditions.setTag(column.name, [`<${value}`]);

          nextLocationQuery = {
            query: stringifyQueryObject(searchConditions),
          };

          break;
        }
        default:
          throw new Error(`Unknown action type. ${action}`);
      }

      ReactRouter.browserHistory.push({
        pathname: location.pathname,
        query: {
          ...location.query,
          cursor: undefined,
          ...nextLocationQuery,
        },
      });
    };
  };

  renderBodyCell = (tableData: TableData | null) => {
    const {eventView, organization, projects, location, summaryConditions} = this.props;

    return (
      column: TableColumn<keyof TableDataRow>,
      dataRow: TableDataRow
    ): React.ReactNode => {
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

      if (field.startsWith('user_misery')) {
        // don't display per cell actions for user_misery
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
    };
  };

  renderHeadCell = (tableMeta: TableData['meta']) => {
    const {eventView, location} = this.props;

    return (column: TableColumn<keyof TableDataRow>, index: number): React.ReactNode => {
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
                title={COLUMN_TITLES[index] || field.field}
                direction={currentSort ? currentSort.kind : undefined}
                canSort={canSort}
                generateSortLink={generateSortLink}
              />
            );
          }}
        </HeaderCell>
      );
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

  render() {
    const {eventView, organization, location, keyTransactions} = this.props;
    const {widths} = this.state;
    const columnOrder = eventView
      .getColumns()
      .map((col: TableColumn<React.ReactText>, i: number) => {
        if (typeof widths[i] === 'number') {
          return {...col, width: widths[i]};
        }
        return col;
      });

    const columnSortBy = eventView.getSorts();
    return (
      <div>
        <DiscoverQuery
          eventView={eventView}
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
                  renderHeadCell: this.renderHeadCell(tableData?.meta) as any,
                  renderBodyCell: this.renderBodyCell(tableData) as any,
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
