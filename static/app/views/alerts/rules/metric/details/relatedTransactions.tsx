import {useState} from 'react';
import styled from '@emotion/styled';
import type {Location} from 'history';

import type {GridColumn} from 'sentry/components/gridEditable';
import GridEditable, {COL_WIDTH_UNDEFINED} from 'sentry/components/gridEditable';
import type {Alignments} from 'sentry/components/gridEditable/sortLink';
import Link from 'sentry/components/links/link';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import type {TableData, TableDataRow} from 'sentry/utils/discover/discoverQuery';
import DiscoverQuery from 'sentry/utils/discover/discoverQuery';
import {getFieldRenderer} from 'sentry/utils/discover/fieldRenderers';
import {fieldAlignment} from 'sentry/utils/discover/fields';
import type {MetricRule} from 'sentry/views/alerts/rules/metric/types';
import {getMetricRuleDiscoverQuery} from 'sentry/views/alerts/utils/getMetricRuleDiscoverUrl';
import type {TableColumn} from 'sentry/views/discover/table/types';
import {transactionSummaryRouteWithQuery} from 'sentry/views/performance/transactionSummary/utils';
import {getProjectID} from 'sentry/views/performance/utils';

import type {TimePeriodType} from './constants';

interface RelatedTransactionsProps {
  filter: string;
  location: Location;
  organization: Organization;
  projects: Project[];
  rule: MetricRule;
  timePeriod: TimePeriodType;
}

function RelatedTransactions({
  organization,
  projects,
  timePeriod,
  rule,
  filter,
  location,
}: RelatedTransactionsProps) {
  const [widths, setWidths] = useState<number[]>([]);
  const eventView = getMetricRuleDiscoverQuery({
    rule,
    timePeriod,
    projects,
  });
  const summaryConditions = `${rule.query} ${filter}`;

  function renderBodyCell(
    tableData: TableData | null,
    column: TableColumn<keyof TableDataRow>,
    dataRow: TableDataRow
  ): React.ReactNode {
    if (!tableData || !tableData.meta) {
      return dataRow[column.key];
    }
    const tableMeta = tableData.meta;

    const field = String(column.key);
    const fieldRenderer = getFieldRenderer(field, tableMeta, false);
    const rendered = fieldRenderer(dataRow, {organization, location});

    if (field === 'transaction') {
      const projectID = getProjectID(dataRow, projects);
      const summaryView = eventView!.clone();
      summaryView.query = summaryConditions;

      const target = transactionSummaryRouteWithQuery({
        organization,
        transaction: String(dataRow.transaction) || '',
        query: summaryView.generateQueryStringObject(),
        projectID,
      });

      return <Link to={target}>{rendered}</Link>;
    }

    return rendered;
  }

  const renderBodyCellWithData = (tableData: TableData | null) => {
    return (
      column: TableColumn<keyof TableDataRow>,
      dataRow: TableDataRow
    ): React.ReactNode => renderBodyCell(tableData, column, dataRow);
  };

  function renderHeadCell(
    tableMeta: TableData['meta'],
    column: TableColumn<keyof TableDataRow>,
    title: React.ReactNode
  ): React.ReactNode {
    const align = fieldAlignment(column.name, column.type, tableMeta);
    const field = {field: column.name, width: column.width};

    return <HeaderCell align={align}>{title || field.field}</HeaderCell>;
  }

  const renderHeadCellWithMeta = (tableMeta: TableData['meta'], columnName: string) => {
    const columnTitles = ['transactions', 'project', columnName, 'users', 'user misery'];

    return (column: TableColumn<keyof TableDataRow>, index: number): React.ReactNode =>
      renderHeadCell(tableMeta, column, columnTitles[index]);
  };

  const handleResizeColumn = (columnIndex: number, nextColumn: GridColumn) => {
    const newWidths: number[] = [...widths];
    newWidths[columnIndex] = nextColumn.width
      ? Number(nextColumn.width)
      : COL_WIDTH_UNDEFINED;
    setWidths(newWidths);
  };

  if (!eventView) {
    return null;
  }

  const columnOrder = eventView
    .getColumns()
    .map((col: TableColumn<React.ReactText>, i: number) => {
      if (typeof widths[i] === 'number') {
        return {...col, width: widths[i]};
      }
      return col;
    });

  const sortedEventView = eventView.withSorts([...eventView.sorts]);
  const columnSortBy = sortedEventView.getSorts();

  return (
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
            onResizeColumn: handleResizeColumn,
            renderHeadCell: renderHeadCellWithMeta(
              tableData?.meta,
              columnOrder[2]!.name
            ) as any,
            renderBodyCell: renderBodyCellWithData(tableData) as any,
          }}
        />
      )}
    </DiscoverQuery>
  );
}

export default RelatedTransactions;

const HeaderCell = styled('div')<{align: Alignments}>`
  display: block;
  width: 100%;
  white-space: nowrap;
  ${(p: {align: Alignments}) => (p.align ? `text-align: ${p.align};` : '')}
`;
