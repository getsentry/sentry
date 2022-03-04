import * as React from 'react';
import styled from '@emotion/styled';
import {Location} from 'history';

import GridEditable, {
  COL_WIDTH_UNDEFINED,
  GridColumn,
} from 'sentry/components/gridEditable';
import {Alignments} from 'sentry/components/gridEditable/sortLink';
import Link from 'sentry/components/links/link';
import {NewQuery, Organization, Project} from 'sentry/types';
import DiscoverQuery, {
  TableData,
  TableDataRow,
} from 'sentry/utils/discover/discoverQuery';
import EventView, {EventData} from 'sentry/utils/discover/eventView';
import {getFieldRenderer} from 'sentry/utils/discover/fieldRenderers';
import {fieldAlignment, getAggregateAlias} from 'sentry/utils/discover/fields';
import {IncidentRule} from 'sentry/views/alerts/incidentRules/types';
import {TableColumn} from 'sentry/views/eventsV2/table/types';
import {DEFAULT_PROJECT_THRESHOLD_METRIC} from 'sentry/views/performance/data';
import {transactionSummaryRouteWithQuery} from 'sentry/views/performance/transactionSummary/utils';

function getProjectID(eventData: EventData, projects: Project[]): string | undefined {
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
  location: Location;
  organization: Organization;
  projects: Project[];
  summaryConditions: string;
};

type TableState = {
  widths: number[];
};
class Table extends React.Component<TableProps, TableState> {
  state: TableState = {
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
    const align = fieldAlignment(column.name, column.type, tableMeta);
    const field = {field: column.name, width: column.width};

    return <HeaderCell align={align}>{title || field.field}</HeaderCell>;
  }

  renderHeadCellWithMeta = (tableMeta: TableData['meta'], columnName: string) => {
    const columnTitles = ['transactions', 'project', columnName, 'users', 'user misery'];

    return (column: TableColumn<keyof TableDataRow>, index: number): React.ReactNode =>
      this.renderHeadCell(tableMeta, column, columnTitles[index]);
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
    return eventView.withSorts([...eventView.sorts]);
  }

  render() {
    const {eventView, organization, location} = this.props;

    const {widths} = this.state;
    const columnOrder = eventView
      .getColumns()
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
                renderHeadCell: this.renderHeadCellWithMeta(
                  tableData?.meta,
                  columnOrder[2].name as string
                ) as any,
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
  filter: string;
  location: Location;
  organization: Organization;
  projects: Project[];
  rule: IncidentRule;
  end?: string;
  start?: string;
};

class RelatedTransactions extends React.Component<Props> {
  render() {
    const {rule, projects, filter, location, organization, start, end} = this.props;
    const aggregateAlias = getAggregateAlias(rule.aggregate);

    const eventQuery: NewQuery = {
      id: undefined,
      name: 'Transactions',
      fields: [
        'transaction',
        'project',
        `${rule.aggregate}`,
        'count_unique(user)',
        `user_misery(${DEFAULT_PROJECT_THRESHOLD_METRIC})`,
      ],
      orderby: `-${aggregateAlias}`,

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

const HeaderCell = styled('div')<{align: Alignments}>`
  display: block;
  width: 100%;
  white-space: nowrap;
  ${(p: {align: Alignments}) => (p.align ? `text-align: ${p.align};` : '')}
`;
