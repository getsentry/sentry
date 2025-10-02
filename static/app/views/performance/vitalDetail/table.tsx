import {Fragment, useCallback, useMemo} from 'react';
import type {Theme} from '@emotion/react';
import styled from '@emotion/styled';
import type {Location, LocationDescriptorObject} from 'history';

import {Tag} from 'sentry/components/core/badge/tag';
import {Link} from 'sentry/components/core/link';
import Pagination from 'sentry/components/pagination';
import GridEditable from 'sentry/components/tables/gridEditable';
import SortLink from 'sentry/components/tables/gridEditable/sortLink';
import useStateBasedColumnResize from 'sentry/components/tables/gridEditable/useStateBasedColumnResize';
import {IconStar} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import {trackAnalytics} from 'sentry/utils/analytics';
import {browserHistory} from 'sentry/utils/browserHistory';
import type {EventsMetaType} from 'sentry/utils/discover/eventView';
import type EventView from 'sentry/utils/discover/eventView';
import {isFieldSortable} from 'sentry/utils/discover/eventView';
import {getFieldRenderer} from 'sentry/utils/discover/fieldRenderers';
import type {Sort} from 'sentry/utils/discover/fields';
import {fieldAlignment, getAggregateAlias} from 'sentry/utils/discover/fields';
import type {WebVital} from 'sentry/utils/fields';
import type {
  TableData,
  TableDataRow,
} from 'sentry/utils/performance/vitals/vitalsDetailsTableQuery';
import VitalsDetailsTableQuery from 'sentry/utils/performance/vitals/vitalsDetailsTableQuery';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import CellAction, {Actions, updateQuery} from 'sentry/views/discover/table/cellAction';
import type {TableColumn} from 'sentry/views/discover/table/types';
import {
  DisplayModes,
  normalizeSearchConditionsWithTransactionName,
  TransactionFilterOptions,
  transactionSummaryRouteWithQuery,
} from 'sentry/views/performance/transactionSummary/utils';
import {getProjectID, getSelectedProjectPlatforms} from 'sentry/views/performance/utils';

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

interface TableProps {
  eventView: EventView;
  location: Location;
  organization: Organization;
  projects: Project[];
  summaryConditions: string;
  theme: Theme;
}

function Table({
  eventView,
  location,
  organization,
  projects,
  summaryConditions,
  theme,
}: TableProps) {
  const handleCellAction = (column: TableColumn<keyof TableDataRow>) => {
    return (action: Actions, value: string | number) => {
      trackAnalytics('performance_views.overview.cellaction', {
        organization,
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

  const renderBodyCell = (
    tableData: TableData | null,
    column: TableColumn<keyof TableDataRow>,
    dataRow: TableDataRow,
    vitalName: WebVital
  ): React.ReactNode => {
    if (!tableData?.meta?.fields) {
      return dataRow[column.key];
    }
    const tableMeta = tableData.meta?.fields;

    const field = String(column.key);

    if (field === getVitalDetailTablePoorStatusFunction(vitalName)) {
      if (dataRow[field]) {
        return (
          <UniqueTagCell>
            <PoorTag>{t('Poor')}</PoorTag>
          </UniqueTagCell>
        );
      }
      if (dataRow[getVitalDetailTableMehStatusFunction(vitalName)]) {
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

    const fieldRenderer = getFieldRenderer(field, tableMeta, false);
    const rendered = fieldRenderer(dataRow, {organization, location, theme});

    const allowActions = [
      Actions.ADD,
      Actions.EXCLUDE,
      Actions.SHOW_GREATER_THAN,
      Actions.SHOW_LESS_THAN,
      Actions.OPEN_EXTERNAL_LINK,
      Actions.OPEN_INTERNAL_LINK,
    ];

    if (field === 'transaction') {
      const projectID = getProjectID(dataRow, projects);
      const summaryView = eventView.clone();
      const conditions = new MutableSearch(summaryConditions);
      conditions.addFilterValues('has', [`${vitalName}`]);
      summaryView.query = conditions.formatString();

      const transaction = String(dataRow.transaction) || '';

      const target = transactionSummaryRouteWithQuery({
        organization,
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
          handleCellAction={handleCellAction(column)}
          allowActions={allowActions}
        >
          <Link
            to={target}
            aria-label={t('See transaction summary of the transaction %s', transaction)}
            onClick={handleSummaryClick}
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
        handleCellAction={handleCellAction(column)}
        allowActions={allowActions}
      >
        {rendered}
      </CellAction>
    );
  };

  const renderBodyCellWithData = (tableData: TableData | null, vitalName: WebVital) => {
    return (
      column: TableColumn<keyof TableDataRow>,
      dataRow: TableDataRow
    ): React.ReactNode => renderBodyCell(tableData, column, dataRow, vitalName);
  };

  const renderHeadCell = (
    column: TableColumn<keyof TableDataRow>,
    title: React.ReactNode,
    tableMeta?: EventsMetaType['fields']
  ): React.ReactNode => {
    // TODO: Need to map table meta keys to aggregate alias since eventView sorting still expects
    // aggregate aliases for now. We'll need to refactor event view to get rid of all aggregate
    // alias references and then we can remove this.
    const aggregateAliasTableMeta: EventsMetaType['fields'] | undefined = tableMeta
      ? {}
      : undefined;
    if (tableMeta) {
      Object.keys(tableMeta).forEach(key => {
        aggregateAliasTableMeta![getAggregateAlias(key)] = tableMeta[key]!;
      });
    }

    const align = fieldAlignment(column.name, column.type, aggregateAliasTableMeta);
    const field = {field: column.name, width: column.width};

    function generateSortLink(): LocationDescriptorObject | undefined {
      if (!aggregateAliasTableMeta) {
        return undefined;
      }

      const nextEventView = eventView.sortOnField(field, aggregateAliasTableMeta);
      const queryStringObject = nextEventView.generateQueryStringObject();

      return {
        ...location,
        query: {...location.query, sort: queryStringObject.sort},
      };
    }
    const currentSort = eventView.sortForField(field, aggregateAliasTableMeta);
    const canSort = isFieldSortable(field, aggregateAliasTableMeta);

    return (
      <SortLink
        align={align}
        title={title || field.field}
        direction={currentSort ? currentSort.kind : undefined}
        canSort={canSort}
        generateSortLink={generateSortLink}
      />
    );
  };

  const renderHeadCellWithMeta = (
    vitalName: WebVital,
    tableMeta?: EventsMetaType['fields']
  ) => {
    return (column: TableColumn<keyof TableDataRow>, index: number): React.ReactNode =>
      renderHeadCell(column, getTableColumnTitle(index, vitalName), tableMeta);
  };

  const renderPrependCellWithData = (
    tableData: TableData | null,
    vitalName: WebVital
  ) => {
    const teamKeyTransactionColumn = eventView
      .getColumns()
      .find((col: TableColumn<string | number>) => col.name === 'team_key_transaction');
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
          return [
            renderHeadCell(teamKeyTransactionColumn, star, tableData?.meta?.fields),
          ];
        }
        return [renderBodyCell(tableData, teamKeyTransactionColumn, dataRow, vitalName)];
      }
      return [];
    };
  };

  const handleSummaryClick = useCallback(() => {
    trackAnalytics('performance_views.overview.navigate.summary', {
      organization,
      project_platforms: getSelectedProjectPlatforms(location, projects),
    });
  }, [organization, projects, location]);

  const getSortedEventView = (vitalName: WebVital) => {
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
  };

  const columns = useMemo(() => {
    const fakeColumnView = eventView.clone();
    fakeColumnView.fields = [...eventView.fields];
    return (
      fakeColumnView
        .getColumns()
        // remove key_transactions from the column order as we'll be rendering it
        // via a prepended column
        .filter(
          (col: TableColumn<string | number>) => col.name !== 'team_key_transaction'
        )
    );
  }, [eventView]);

  const {columns: columnOrder, handleResizeColumn} = useStateBasedColumnResize({
    columns,
  });

  const vitalName = vitalNameFromLocation(location);
  const sortedEventView = getSortedEventView(vitalName);
  const columnSortBy = sortedEventView.getSorts();

  return (
    <div>
      <VitalsDetailsTableQuery
        eventView={sortedEventView}
        orgSlug={organization.slug}
        location={location}
        limit={10}
        referrer="api.insights.vital-detail"
      >
        {({pageLinks, isLoading, tableData}) => (
          <Fragment>
            <GridEditable
              isLoading={isLoading}
              data={tableData ? tableData.data : []}
              columnOrder={columnOrder}
              columnSortBy={columnSortBy}
              grid={{
                onResizeColumn: handleResizeColumn,
                renderHeadCell: renderHeadCellWithMeta(
                  vitalName,
                  tableData?.meta?.fields
                ) as any,
                renderBodyCell: renderBodyCellWithData(tableData, vitalName) as any,
                renderPrependColumns: renderPrependCellWithData(
                  tableData,
                  vitalName
                ) as any,
                prependColumnWidths: ['max-content'],
              }}
            />
            <Pagination pageLinks={pageLinks} />
          </Fragment>
        )}
      </VitalsDetailsTableQuery>
    </div>
  );
}

const UniqueTagCell = styled('div')`
  text-align: right;
  justify-self: flex-end;
  flex-grow: 1;
`;

const GoodTag = styled(Tag)`
  background-color: ${p => p.theme[vitalStateColors[VitalState.GOOD]]};
  color: ${p => p.theme.white};
`;

const MehTag = styled(Tag)`
  background-color: ${p => p.theme[vitalStateColors[VitalState.MEH]]};
  color: ${p => p.theme.white};
`;

const PoorTag = styled(Tag)`
  background-color: ${p => p.theme[vitalStateColors[VitalState.POOR]]};
  color: ${p => p.theme.white};
`;

export default Table;
