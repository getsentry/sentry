import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import type {Location} from 'history';

import {Link} from '@sentry/scraps/link';

import GridEditable from 'sentry/components/tables/gridEditable';
import type {Alignments} from 'sentry/components/tables/gridEditable/sortLink';
import useStateBasedColumnResize from 'sentry/components/tables/gridEditable/useStateBasedColumnResize';
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
  const theme = useTheme();
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
    if (!tableData?.meta) {
      return dataRow[column.key];
    }
    const tableMeta = tableData.meta;

    const field = String(column.key);
    const fieldRenderer = getFieldRenderer(field, tableMeta, false);
    const rendered = fieldRenderer(dataRow, {organization, location, theme});

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

  const {columns, handleResizeColumn} = useStateBasedColumnResize({
    columns: eventView?.getColumns() ?? [],
  });

  if (!eventView) {
    return null;
  }

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
          columnOrder={columns}
          columnSortBy={columnSortBy}
          grid={{
            onResizeColumn: handleResizeColumn,
            renderHeadCell: renderHeadCellWithMeta(
              tableData?.meta,
              columns[2]!.name
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
