import {Component, Fragment} from 'react';
import styled from '@emotion/styled';
import type {Location} from 'history';

import GridEditable, {
  COL_WIDTH_UNDEFINED,
  GridColumn,
} from 'sentry/components/gridEditable';
import type {Alignments} from 'sentry/components/gridEditable/sortLink';
import Link from 'sentry/components/links/link';
import {Organization, Project} from 'sentry/types';
import DiscoverQuery, {
  TableData,
  TableDataRow,
} from 'sentry/utils/discover/discoverQuery';
import EventView from 'sentry/utils/discover/eventView';
import {getFieldRenderer} from 'sentry/utils/discover/fieldRenderers';
import {fieldAlignment} from 'sentry/utils/discover/fields';
import type {MetricRule} from 'sentry/views/alerts/rules/metric/types';
import {getMetricRuleDiscoverQuery} from 'sentry/views/alerts/utils/getMetricRuleDiscoverUrl';
import type {TableColumn} from 'sentry/views/discover/table/types';
import {transactionSummaryRouteWithQuery} from 'sentry/views/performance/transactionSummary/utils';
import {getProjectID} from 'sentry/views/performance/utils';

import type {TimePeriodType} from './constants';

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
class Table extends Component<TableProps, TableState> {
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
    const fieldRenderer = getFieldRenderer(field, tableMeta, false);
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
      <Fragment>
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
      </Fragment>
    );
  }
}

interface Props {
  filter: string;
  location: Location;
  organization: Organization;
  projects: Project[];
  rule: MetricRule;
  timePeriod: TimePeriodType;
}

function RelatedTransactions({
  rule,
  projects,
  filter,
  location,
  organization,
  timePeriod,
}: Props) {
  const eventView = getMetricRuleDiscoverQuery({
    rule,
    timePeriod,
    projects,
  });

  if (!eventView) {
    return null;
  }

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

export default RelatedTransactions;

const HeaderCell = styled('div')<{align: Alignments}>`
  display: block;
  width: 100%;
  white-space: nowrap;
  ${(p: {align: Alignments}) => (p.align ? `text-align: ${p.align};` : '')}
`;
