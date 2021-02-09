import React from 'react';
import {Location, LocationDescriptorObject} from 'history';

import GridEditable, {COL_WIDTH_UNDEFINED, GridColumn} from 'app/components/gridEditable';
import SortLink from 'app/components/gridEditable/sortLink';
import Link from 'app/components/links/link';
import {NewQuery, Organization, Project} from 'app/types';
import DiscoverQuery, {TableData, TableDataRow} from 'app/utils/discover/discoverQuery';
import EventView, {EventData, isFieldSortable} from 'app/utils/discover/eventView';
import {getFieldRenderer} from 'app/utils/discover/fieldRenderers';
import {fieldAlignment} from 'app/utils/discover/fields';
import {TableColumn} from 'app/views/eventsV2/table/types';
import {transactionSummaryRouteWithQuery} from 'app/views/performance/transactionSummary/utils';
import {IncidentRule} from 'app/views/settings/incidentRules/types';

const COLUMN_TITLES = ['slowest transactions', 'project', 'p95', 'users', 'user misery'];

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

type TableProps = {
  eventView: EventView;
  organization: Organization;
  location: Location;
  summaryConditions: string;

  projects: Project[];
  columnTitles?: string[];
};

type TableState = {
  widths: number[];
};
class Table extends React.Component<TableProps, TableState> {
  state = {
    widths: [],
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

      return <Link to={target}>{rendered}</Link>;
    }

    return rendered;
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
      isFieldSortable(field, tableMeta) && field.field !== 'key_transaction';
    return (
      <SortLink
        align={align}
        title={title || field.field}
        direction={currentSort ? currentSort.kind : undefined}
        canSort={canSort}
        generateSortLink={generateSortLink}
      />
    );
  }

  renderHeadCellWithMeta = (tableMeta: TableData['meta']) => {
    return (column: TableColumn<keyof TableDataRow>, index: number): React.ReactNode =>
      this.renderHeadCell(tableMeta, column, COLUMN_TITLES[index]);
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

    return eventView.withSorts([
      {
        field: 'key_transaction',
        kind: 'desc',
      },
      ...eventView.sorts,
    ]);
  }

  render() {
    const {eventView, organization, location} = this.props;

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

    return (
      <React.Fragment>
        <DiscoverQuery
          eventView={sortedEventView}
          orgSlug={organization.slug}
          location={location}
        >
          {({isLoading, tableData}) => (
            <GridEditable
              isLoading={isLoading}
              data={tableData ? tableData.data.slice(0, 5) : []}
              columnOrder={columnOrder}
              columnSortBy={columnSortBy}
              grid={{
                onResizeColumn: this.handleResizeColumn,
                renderHeadCell: this.renderHeadCellWithMeta(tableData?.meta) as any,
                renderBodyCell: this.renderBodyCellWithData(tableData) as any,
              }}
              location={location}
            />
          )}
        </DiscoverQuery>
      </React.Fragment>
    );
  }
}

type Props = {
  organization: Organization;
  location: Location;
  rule: IncidentRule;
  projects: Project[];
  filter: string;
  start?: string;
  end?: string;
};

class RelatedTransactions extends React.Component<Props> {
  render() {
    const {rule, projects, filter, location, organization, start, end} = this.props;

    const eventQuery: NewQuery = {
      id: undefined,
      name: 'Slowest Transactions',
      fields: [
        'transaction',
        'project',
        'p95()',
        'count_unique(user)',
        `user_misery(${organization.apdexThreshold})`,
      ],
      orderby: `user_misery(${organization.apdexThreshold})`,

      query: `${rule.query}`,
      version: 2,
      projects: projects.map(project => Number(project.id)),
      start,
      end,
    };

    const eventView = EventView.fromSavedQuery(eventQuery);

    return (
      <Table
        eventView={eventView}
        projects={projects}
        organization={organization}
        location={location}
        summaryConditions={`${rule.query} ${filter}`}
      />
    );
  }
}

export default RelatedTransactions;
