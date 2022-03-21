import * as React from 'react';
import {browserHistory} from 'react-router';
import styled from '@emotion/styled';
import {Location, LocationDescriptorObject} from 'history';

import GridEditable, {
  COL_WIDTH_UNDEFINED,
  GridColumn,
} from 'sentry/components/gridEditable';
import SortLink from 'sentry/components/gridEditable/sortLink';
import Link from 'sentry/components/links/link';
import Pagination from 'sentry/components/pagination';
import Tag from 'sentry/components/tag';
import {IconStar} from 'sentry/icons';
import {t} from 'sentry/locale';
import {Organization, Project} from 'sentry/types';
import {trackAnalyticsEvent} from 'sentry/utils/analytics';
import EventView, {EventData, isFieldSortable} from 'sentry/utils/discover/eventView';
import {getFieldRenderer} from 'sentry/utils/discover/fieldRenderers';
import {
  fieldAlignment,
  getAggregateAlias,
  Sort,
  WebVital,
} from 'sentry/utils/discover/fields';
import VitalsDetailsTableQuery, {
  TableData,
  TableDataRow,
} from 'sentry/utils/performance/vitals/vitalsDetailsTableQuery';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import CellAction, {Actions, updateQuery} from 'sentry/views/eventsV2/table/cellAction';
import {TableColumn} from 'sentry/views/eventsV2/table/types';

import {DisplayModes} from '../transactionSummary/transactionOverview/charts';
import {
  normalizeSearchConditionsWithTransactionName,
  TransactionFilterOptions,
  transactionSummaryRouteWithQuery,
} from '../transactionSummary/utils';

import {
  getVitalDetailTableMehStatusFunction,
  getVitalDetailTablePoorStatusFunction,
  vitalAbbreviations,
  vitalNameFromLocation,
  VitalState,
  vitalStateColors,
} from './utils';

const COLUMN_TITLES = ['Transaction', 'Project', 'Unique Users', 'Count'];

const getTableColumnTitle = (index: number, vitalName: WebVital) => {
  const abbrev = vitalAbbreviations[vitalName];
  const titles = [
    ...COLUMN_TITLES,
    `p50(${abbrev})`,
    `p75(${abbrev})`,
    `p95(${abbrev})`,
    `Status`,
  ];
  return titles[index];
};

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
  location: Location;
  organization: Organization;
  projects: Project[];
  setError: (msg: string | undefined) => void;

  summaryConditions: string;
};

type State = {
  widths: number[];
};

class Table extends React.Component<Props, State> {
  state: State = {
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

      const searchConditions = normalizeSearchConditionsWithTransactionName(
        eventView.query
      );

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
    dataRow: TableDataRow,
    vitalName: WebVital
  ): React.ReactNode {
    const {eventView, organization, projects, location, summaryConditions} = this.props;

    if (!tableData || !tableData.meta) {
      return dataRow[column.key];
    }
    const tableMeta = tableData.meta;

    const field = String(column.key);

    if (field === getVitalDetailTablePoorStatusFunction(vitalName)) {
      if (dataRow[getAggregateAlias(field)]) {
        return (
          <UniqueTagCell>
            <PoorTag>{t('Poor')}</PoorTag>
          </UniqueTagCell>
        );
      }
      if (dataRow[getAggregateAlias(getVitalDetailTableMehStatusFunction(vitalName))]) {
        return (
          <UniqueTagCell>
            <MehTag>{t('Meh')}</MehTag>
          </UniqueTagCell>
        );
      }
      return (
        <UniqueTagCell>
          <GoodTag>{t('Good')}</GoodTag>
        </UniqueTagCell>
      );
    }

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
      const conditions = new MutableSearch(summaryConditions);
      conditions.addFilterValues('has', [`${vitalName}`]);
      summaryView.query = conditions.formatString();

      const transaction = String(dataRow.transaction) || '';

      const target = transactionSummaryRouteWithQuery({
        orgSlug: organization.slug,
        transaction,
        query: summaryView.generateQueryStringObject(),
        projectID,
        showTransactions: TransactionFilterOptions.RECENT,
        display: DisplayModes.VITALS,
      });

      return (
        <CellAction
          column={column}
          dataRow={dataRow}
          handleCellAction={this.handleCellAction(column)}
          allowActions={allowActions}
        >
          <Link
            to={target}
            aria-label={t('See transaction summary of the transaction %s', transaction)}
            onClick={this.handleSummaryClick}
          >
            {rendered}
          </Link>
        </CellAction>
      );
    }

    if (field.startsWith('team_key_transaction')) {
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

  renderBodyCellWithData = (tableData: TableData | null, vitalName: WebVital) => {
    return (
      column: TableColumn<keyof TableDataRow>,
      dataRow: TableDataRow
    ): React.ReactNode => this.renderBodyCell(tableData, column, dataRow, vitalName);
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
  }

  renderHeadCellWithMeta = (tableMeta: TableData['meta'], vitalName: WebVital) => {
    return (column: TableColumn<keyof TableDataRow>, index: number): React.ReactNode =>
      this.renderHeadCell(tableMeta, column, getTableColumnTitle(index, vitalName));
  };

  renderPrependCellWithData = (tableData: TableData | null, vitalName: WebVital) => {
    const {eventView} = this.props;
    const teamKeyTransactionColumn = eventView
      .getColumns()
      .find((col: TableColumn<React.ReactText>) => col.name === 'team_key_transaction');
    return (isHeader: boolean, dataRow?: any) => {
      if (teamKeyTransactionColumn) {
        if (isHeader) {
          const star = (
            <IconStar
              key="keyTransaction"
              color="yellow300"
              isSolid
              data-test-id="key-transaction-header"
            />
          );
          return [this.renderHeadCell(tableData?.meta, teamKeyTransactionColumn, star)];
        }
        return [
          this.renderBodyCell(tableData, teamKeyTransactionColumn, dataRow, vitalName),
        ];
      }
      return [];
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

  getSortedEventView(vitalName: WebVital) {
    const {eventView} = this.props;

    const aggregateFieldPoor = getAggregateAlias(
      getVitalDetailTablePoorStatusFunction(vitalName)
    );
    const aggregateFieldMeh = getAggregateAlias(
      getVitalDetailTableMehStatusFunction(vitalName)
    );
    const isSortingByStatus = eventView.sorts.some(
      sort =>
        sort.field.includes(aggregateFieldPoor) || sort.field.includes(aggregateFieldMeh)
    );

    const additionalSorts: Sort[] = isSortingByStatus
      ? []
      : [
          {
            field: 'team_key_transaction',
            kind: 'desc',
          },
          {
            field: aggregateFieldPoor,
            kind: 'desc',
          },
          {
            field: aggregateFieldMeh,
            kind: 'desc',
          },
        ];

    return eventView.withSorts([...additionalSorts, ...eventView.sorts]);
  }

  render() {
    const {eventView, organization, location} = this.props;
    const {widths} = this.state;

    const fakeColumnView = eventView.clone();
    fakeColumnView.fields = [...eventView.fields];
    const columnOrder = fakeColumnView
      .getColumns()
      // remove key_transactions from the column order as we'll be rendering it
      // via a prepended column
      .filter((col: TableColumn<React.ReactText>) => col.name !== 'team_key_transaction')
      .slice(0, -1)
      .map((col: TableColumn<React.ReactText>, i: number) => {
        if (typeof widths[i] === 'number') {
          return {...col, width: widths[i]};
        }
        return col;
      });

    const vitalName = vitalNameFromLocation(location);
    const sortedEventView = this.getSortedEventView(vitalName);
    const columnSortBy = sortedEventView.getSorts();

    return (
      <div>
        <VitalsDetailsTableQuery
          eventView={sortedEventView}
          orgSlug={organization.slug}
          location={location}
          limit={10}
          referrer="api.performance.vital-detail"
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
                  renderHeadCell: this.renderHeadCellWithMeta(
                    tableData?.meta,
                    vitalName
                  ) as any,
                  renderBodyCell: this.renderBodyCellWithData(
                    tableData,
                    vitalName
                  ) as any,
                  renderPrependColumns: this.renderPrependCellWithData(
                    tableData,
                    vitalName
                  ) as any,
                  prependColumnWidths: ['max-content'],
                }}
                location={location}
              />
              <Pagination pageLinks={pageLinks} />
            </React.Fragment>
          )}
        </VitalsDetailsTableQuery>
      </div>
    );
  }
}

const UniqueTagCell = styled('div')`
  text-align: right;
  justify-self: flex-end;
  flex-grow: 1;
`;

const GoodTag = styled(Tag)`
  div {
    background-color: ${p => p.theme[vitalStateColors[VitalState.GOOD]]};
  }
  span {
    color: ${p => p.theme.white};
  }
`;

const MehTag = styled(Tag)`
  div {
    background-color: ${p => p.theme[vitalStateColors[VitalState.MEH]]};
  }
  span {
    color: ${p => p.theme.white};
  }
`;

const PoorTag = styled(Tag)`
  div {
    background-color: ${p => p.theme[vitalStateColors[VitalState.POOR]]};
  }
  span {
    color: ${p => p.theme.white};
  }
`;

export default Table;
