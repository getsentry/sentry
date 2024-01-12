import {Fragment, useEffect, useState} from 'react';
import styled from '@emotion/styled';
import {Location, LocationDescriptorObject} from 'history';
import isEqual from 'lodash/isEqual';
import omit from 'lodash/omit';
import * as qs from 'query-string';

import GuideAnchor from 'sentry/components/assistant/guideAnchor';
import {Button} from 'sentry/components/button';
import Checkbox from 'sentry/components/checkbox';
import GridEditable, {
  COL_WIDTH_UNDEFINED,
  GridColumn,
  GridColumnHeader,
} from 'sentry/components/gridEditable';
import SortLink, {Alignments} from 'sentry/components/gridEditable/sortLink';
import Link from 'sentry/components/links/link';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import Pagination from 'sentry/components/pagination';
import BaseSearchBar from 'sentry/components/searchBar';
import {Tooltip} from 'sentry/components/tooltip';
import {IconIssues} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {Organization} from 'sentry/types';
import {trackAnalytics} from 'sentry/utils/analytics';
import DiscoverQuery, {
  TableData,
  TableDataRow,
} from 'sentry/utils/discover/discoverQuery';
import EventView, {isFieldSortable, MetaType} from 'sentry/utils/discover/eventView';
import {getFieldRenderer} from 'sentry/utils/discover/fieldRenderers';
import {getAggregateAlias, RateUnits} from 'sentry/utils/discover/fields';
import {normalizeUrl} from 'sentry/utils/withDomainRequired';
import TopResultsIndicator from 'sentry/views/discover/table/topResultsIndicator';
import {TableColumn} from 'sentry/views/discover/table/types';
import {ThroughputCell} from 'sentry/views/starfish/components/tableCells/throughputCell';
import {TimeSpentCell} from 'sentry/views/starfish/components/tableCells/timeSpentCell';
import {IssueCounts, useIssueCounts} from 'sentry/views/starfish/queries/useIssueCounts';
import {TIME_SPENT_IN_SERVICE} from 'sentry/views/starfish/utils/generatePerformanceEventView';
import {DataTitles} from 'sentry/views/starfish/views/spans/types';

const COLUMN_TITLES = [
  t('Endpoint'),
  DataTitles.throughput,
  DataTitles.avg,
  DataTitles.errorCount,
  DataTitles.timeSpent,
  t('Issues'),
];

type Props = {
  eventView: EventView;
  inactiveTransactions: string[];
  location: Location;
  organization: Organization;
  setError: (msg: string | undefined) => void;
  setInactiveTransactions: (endpoints: string[]) => void;
  setTransactionsList: (endpoints: string[]) => void;
  transactionsList: string[];
};

export type TableColumnHeader = GridColumnHeader<keyof TableDataRow> & {
  column?: TableColumn<keyof TableDataRow>['column']; // TODO - remove this once gridEditable is properly typed
};

function QueryIssueCounts({
  setTransactionsList,
  transactionsList,
  eventView,
  tableData,
  children,
}) {
  const transactions: Map<string, string> = new Map();
  const newTransactionsList: string[] = [];
  transactions.set('is:unresolved', '');
  if (tableData) {
    tableData.data.forEach(row => {
      transactions.set(`transaction:${row.transaction} is:unresolved`, row.transaction);
      newTransactionsList.push(row.transaction);
    });
  }
  useEffect(() => {
    if (!isEqual(transactionsList, newTransactionsList)) {
      setTransactionsList(newTransactionsList);
    }
  });
  const {data, isLoading} = useIssueCounts(eventView, Array.from(transactions.keys()));
  const result: Map<string, IssueCounts> = new Map();
  for (const [query, count] of data ? Object.entries(data) : []) {
    if (transactions.has(query)) {
      result.set(transactions.get(query)!, count);
    }
  }

  return children({issueCounts: result, isIssueLoading: isLoading});
}

function EndpointList({
  eventView,
  location,
  organization,
  setError,
  setTransactionsList,
  transactionsList,
  inactiveTransactions,
  setInactiveTransactions,
}: Props) {
  const [widths, setWidths] = useState<number[]>([]);
  const [_eventView, setEventView] = useState<EventView>(eventView);
  const overallEventView = _eventView.clone();
  overallEventView.query = '';
  const overallFields = overallEventView.fields;
  overallEventView.fields = overallFields.filter(
    field => field.field !== 'transaction' && field.field !== 'http.method'
  );

  // Effect to keep the parent eventView in sync with the child, so that chart zoom and time period can be accounted for.
  useEffect(() => {
    setEventView(prevEventView => {
      const cloned = eventView.clone();
      cloned.query = prevEventView.query;
      return cloned;
    });
  }, [eventView]);

  function renderBodyCell(
    tableData: TableData | null,
    column: TableColumnHeader,
    dataRow: TableDataRow,
    _deltaColumnMap: Record<string, string>,
    issueCounts: Map<string, null | number>
  ): React.ReactNode {
    if (!tableData || !tableData.meta) {
      return dataRow[column.key];
    }
    const tableMeta = tableData.meta;

    const field = String(column.key);
    const fieldRenderer = getFieldRenderer(field, tableMeta, false);
    const rendered = fieldRenderer(dataRow, {organization, location});
    const index = tableData.data.indexOf(dataRow);

    function toggleCheckbox(transaction: string) {
      let newInactiveTransactions = inactiveTransactions.slice();
      if (inactiveTransactions.indexOf(transaction) === -1) {
        newInactiveTransactions.push(transaction);
      } else {
        newInactiveTransactions = inactiveTransactions.filter(
          name => name !== transaction
        );
      }
      setInactiveTransactions(newInactiveTransactions);
    }

    if (field === 'transaction') {
      const method = dataRow['http.method'];
      if (method === undefined && dataRow.transaction === 'Overall') {
        return (
          <span>
            <TopResultsIndicator count={tableData.data.length + 2} index={6} />
            <TransactionColumn>
              <TransactionCheckbox
                checked={
                  inactiveTransactions.indexOf(dataRow.transaction as string) === -1
                }
                onChange={() => toggleCheckbox(dataRow.transaction as string)}
              />
              <TransactionText>{dataRow.transaction}</TransactionText>
            </TransactionColumn>
          </span>
        );
      }
      const endpointName =
        method && !dataRow.transaction.toString().startsWith(method.toString())
          ? `${method} ${dataRow.transaction}`
          : dataRow.transaction;

      return (
        <TransactionColumn>
          <TransactionCheckbox
            checked={inactiveTransactions.indexOf(dataRow.transaction as string) === -1}
            onChange={() => toggleCheckbox(dataRow.transaction as string)}
          />
          <Link
            to={normalizeUrl(
              `/organizations/${
                organization.slug
              }/starfish/endpoint-overview/?${qs.stringify({
                endpoint: dataRow.transaction,
                'http.method': dataRow['http.method'],
                statsPeriod: eventView.statsPeriod,
                project: eventView.project,
                start: eventView.start,
                end: eventView.end,
              })}`
            )}
            style={{display: `block`, width: `100%`}}
            onClick={() => {
              trackAnalytics('starfish.web_service_view.endpoint_list.endpoint.clicked', {
                organization,
                endpoint: dataRow.transaction,
              });
            }}
          >
            <TopResultsIndicator count={tableData.data.length + 2} index={index} />
            <TransactionText>{endpointName}</TransactionText>
          </Link>
        </TransactionColumn>
      );
    }

    if (field === TIME_SPENT_IN_SERVICE) {
      const cumulativeTime = Number(dataRow['sum(transaction.duration)']);
      const cumulativeTimePercentage = Number(dataRow[TIME_SPENT_IN_SERVICE]);
      return (
        <TimeSpentCell percentage={cumulativeTimePercentage} total={cumulativeTime} />
      );
    }

    // TODO: This can be removed if/when the backend returns this field's type
    // as `"rate"` and its unit as `"1/second"
    if (field === 'tps()') {
      return (
        <ThroughputCell rate={dataRow[field] as number} unit={RateUnits.PER_SECOND} />
      );
    }

    if (field === 'project') {
      return null;
    }

    if (field === 'issues') {
      const transactionName = dataRow.transaction as string;
      const method = dataRow['http.method'];
      let issueCount = issueCounts.has(transactionName)
        ? issueCounts.get(transactionName)
        : undefined;
      if (issueCount === null) {
        issueCount = 0;
      }
      if (method === undefined && transactionName === 'Overall') {
        issueCount = issueCounts.get('');
      }
      return (
        <IssueButton
          to={`/issues/?${qs.stringify({
            project: eventView.project,
            query: `is:unresolved transaction:"${dataRow.transaction}"`,
            statsPeriod: eventView.statsPeriod,
            start: eventView.start,
            end: eventView.end,
          })}`}
        >
          <IconIssues size="sm" />
          <IssueLabel>
            {issueCount !== undefined ? issueCount : <LoadingIndicator size={20} mini />}
            {issueCount === 100 && '+'}
          </IssueLabel>
        </IssueButton>
      );
    }

    const fieldName = getAggregateAlias(field);
    const value = dataRow[fieldName];
    if (tableMeta[fieldName] === 'integer' && typeof value === 'number' && value > 999) {
      return (
        <Tooltip
          title={value.toLocaleString()}
          containerDisplayMode="block"
          position="right"
        >
          {rendered}
        </Tooltip>
      );
    }

    return rendered;
  }

  function combineTableDataWithOverall(
    tableData: TableData | null,
    overallTableData: TableData | null
  ): TableData {
    const overallRow = overallTableData?.data?.[0];
    const combinedData = Object.assign({}, tableData);
    if (overallRow && tableData?.data) {
      overallRow.transaction = 'Overall';
      combinedData.data = [overallRow, ...tableData.data];
    }
    return combinedData;
  }

  function renderBodyCellWithData(
    tableData: TableData | null,
    issueCounts: Map<string, null | number>
  ) {
    const deltaColumnMap: Record<string, string> = {};
    if (tableData?.data?.[0]) {
      Object.keys(tableData.data[0]).forEach(col => {
        if (
          col.startsWith(
            'equation|(percentile_range(transaction.duration,0.95,lessOrEquals'
          )
        ) {
          deltaColumnMap['avg()'] = col;
        }
      });
    }

    return (column: TableColumnHeader, dataRow: TableDataRow): React.ReactNode =>
      renderBodyCell(tableData, column, dataRow, deltaColumnMap, issueCounts);
  }

  function renderHeadCell(
    tableMeta: TableData['meta'],
    column: TableColumnHeader,
    title: React.ReactNode
  ): React.ReactNode {
    let align: Alignments = 'right';
    if (title === 'Endpoint') {
      align = 'left';
    }
    const field = {
      field: column.column?.kind === 'equation' ? (column.key as string) : column.name,
      width: column.width,
    };

    const aggregateAliasTableMeta: MetaType = {};
    if (tableMeta) {
      Object.keys(tableMeta).forEach(key => {
        aggregateAliasTableMeta[getAggregateAlias(key)] = tableMeta[key];
      });
    }

    function generateSortLink(): LocationDescriptorObject | undefined {
      if (!tableMeta) {
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

    const currentSortKind = currentSort ? currentSort.kind : undefined;

    const sortLink = (
      <SortLink
        align={align}
        title={title || field.field}
        direction={currentSortKind}
        canSort={canSort}
        generateSortLink={generateSortLink}
        onClick={() => {
          trackAnalytics('starfish.web_service_view.endpoint_list.header.clicked', {
            organization,
            direction: currentSortKind === 'desc' ? 'asc' : 'desc',
            header: title || field.field,
          });
        }}
      />
    );

    return sortLink;
  }

  function renderHeadCellWithMeta(tableMeta: TableData['meta']) {
    const newColumnTitles = COLUMN_TITLES;
    return (column: TableColumnHeader, index: number): React.ReactNode =>
      renderHeadCell(tableMeta, column, newColumnTitles[index]);
  }

  function handleResizeColumn(columnIndex: number, nextColumn: GridColumn) {
    setWidths(prevWidths =>
      prevWidths.map((width, index) =>
        index === columnIndex ? Number(nextColumn.width ?? COL_WIDTH_UNDEFINED) : width
      )
    );
  }

  function handleSearch(query: string) {
    const clonedEventView = eventView.clone();

    // Default to fuzzy finding for now
    clonedEventView.query += `transaction:*${query}*`;
    setEventView(clonedEventView);

    trackAnalytics('starfish.web_service_view.endpoint_list.search', {
      organization,
      query,
    });
  }

  const eventViewColumns = eventView.getColumns();
  eventViewColumns.push({
    key: 'issues',
    name: 'Issues',
    type: 'number',
    width: -1,
  } as TableColumn<React.ReactText>);
  const columnOrder = eventViewColumns
    .filter(
      (col: TableColumn<React.ReactText>) =>
        col.name !== 'project' &&
        col.name !== 'http.method' &&
        col.name !== 'total.transaction_duration' &&
        col.name !== 'sum(transaction.duration)'
    )
    .map((col: TableColumn<React.ReactText>, i: number) => {
      if (typeof widths[i] === 'number') {
        return {...col, width: widths[i]};
      }
      return col;
    });

  const columnSortBy = eventView.getSorts();

  return (
    <GuideAnchor target="performance_table" position="top-start">
      <StyledSearchBar placeholder={t('Search for endpoints')} onSearch={handleSearch} />
      <DiscoverQuery
        eventView={overallEventView}
        orgSlug={organization.slug}
        location={omit(location, 'cursor')}
        setError={error => setError(error?.message)}
        referrer="api.starfish.web-service-overall"
        queryExtras={{dataset: 'metrics', cursor: ''}}
        limit={1}
      >
        {({tableData: overallTableData}) => (
          <DiscoverQuery
            eventView={_eventView}
            orgSlug={organization.slug}
            location={location}
            setError={error => setError(error?.message)}
            referrer="api.starfish.endpoint-list"
            queryExtras={{dataset: 'metrics'}}
            limit={5}
          >
            {({pageLinks, isLoading, tableData}) => (
              <Fragment>
                <QueryIssueCounts
                  setTransactionsList={setTransactionsList}
                  transactionsList={transactionsList}
                  eventView={eventView}
                  tableData={tableData}
                >
                  {({issueCounts, isIssueLoading}) => (
                    <GridEditable
                      isLoading={isLoading && isIssueLoading}
                      data={
                        tableData && overallTableData
                          ? combineTableDataWithOverall(tableData, overallTableData).data
                          : []
                      }
                      columnOrder={columnOrder}
                      columnSortBy={columnSortBy}
                      grid={{
                        onResizeColumn: handleResizeColumn,
                        renderHeadCell: renderHeadCellWithMeta(tableData?.meta),
                        renderBodyCell: renderBodyCellWithData(tableData, issueCounts),
                      }}
                      location={location}
                    />
                  )}
                </QueryIssueCounts>

                <Pagination pageLinks={pageLinks} />
              </Fragment>
            )}
          </DiscoverQuery>
        )}
      </DiscoverQuery>
    </GuideAnchor>
  );
}

export default EndpointList;

const StyledSearchBar = styled(BaseSearchBar)`
  margin-bottom: ${space(2)};
`;

const TransactionColumn = styled('div')`
  display: flex;
`;

const TransactionText = styled('div')`
  margin-top: ${space(0.5)};
`;

const TransactionCheckbox = styled(Checkbox)`
  top: ${space(0.5)};
  margin-right: ${space(1)};
`;

const IssueButton = styled(Button)`
  width: 100%;
  margin-left: auto;
`;

const IssueLabel = styled('div')`
  padding-left: ${space(1)};
  margin-left: auto;
  position: relative;
`;
