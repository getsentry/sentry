import React from 'react';
import {Location, Query} from 'history';
import styled from '@emotion/styled';
import {browserHistory} from 'react-router';

import {Organization} from 'app/types';
import space from 'app/styles/space';
import {t} from 'app/locale';
import DiscoverButton from 'app/components/discoverButton';
import DropdownControl, {DropdownItem} from 'app/components/dropdownControl';
import PanelTable from 'app/components/panels/panelTable';
import Link from 'app/components/links/link';
import LoadingIndicator from 'app/components/loadingIndicator';
import Pagination from 'app/components/pagination';
import overflowEllipsis from 'app/styles/overflowEllipsis';
import CellAction, {Actions, updateQuery} from 'app/views/eventsV2/table/cellAction';
import {TableColumn} from 'app/views/eventsV2/table/types';
import HeaderCell from 'app/views/eventsV2/table/headerCell';
import EventView, {MetaType} from 'app/utils/discover/eventView';
import SortLink from 'app/components/gridEditable/sortLink';
import {getFieldRenderer} from 'app/utils/discover/fieldRenderers';
import {getAggregateAlias, Sort} from 'app/utils/discover/fields';
import {generateEventSlug} from 'app/utils/discover/urls';
import {trackAnalyticsEvent} from 'app/utils/analytics';
import {getDuration} from 'app/utils/formatters';
import {decodeScalar} from 'app/utils/queryString';
import DiscoverQuery, {TableData, TableDataRow} from 'app/utils/discover/discoverQuery';
import {tokenizeSearch, stringifyQueryObject} from 'app/utils/tokenizeSearch';

import {GridCell, GridCellNumber} from '../styles';
import {getTransactionDetailsUrl, getTransactionComparisonUrl} from '../utils';
import BaselineQuery, {BaselineQueryResults} from './baselineQuery';

const TOP_TRANSACTION_LIMIT = 5;

type FilterOption = {
  query: [string, string][] | null;
  sort: Sort;
  value: string;
  label: string;
};

function getFilterOptions({p95}: {p95: number}): FilterOption[] {
  return [
    {
      query: null,
      sort: {kind: 'asc', field: 'transaction.duration'},
      value: 'fastest',
      label: t('Fastest Transactions'),
    },
    {
      query: [['transaction.duration', `<=${p95.toFixed(0)}`]],
      sort: {kind: 'desc', field: 'transaction.duration'},
      value: 'slow',
      label: t('Slow Transactions (p95)'),
    },
    {
      query: null,
      sort: {kind: 'desc', field: 'transaction.duration'},
      value: 'outlier',
      label: t('Outlier Transactions (p100)'),
    },
    {
      query: null,
      sort: {kind: 'desc', field: 'timestamp'},
      value: 'recent',
      label: t('Recent Transactions'),
    },
  ];
}

function getTransactionSort(
  location: Location,
  p95: number
): {selected: FilterOption; options: FilterOption[]} {
  const options = getFilterOptions({p95});
  const urlParam = decodeScalar(location.query.showTransactions) || 'slow';
  const selected = options.find(opt => opt.value === urlParam) || options[0];
  return {selected, options};
}

type WrapperProps = {
  eventView: EventView;
  location: Location;
  organization: Organization;
  transactionName: string;
  slowDuration: number | undefined;
};

class TransactionList extends React.Component<WrapperProps> {
  handleCursor = (cursor: string, pathname: string, query: Query) => {
    browserHistory.push({
      pathname,
      query: {...query, transactionCursor: cursor},
    });
  };

  handleTransactionFilterChange = (value: string) => {
    const {location, organization} = this.props;
    trackAnalyticsEvent({
      eventKey: 'performance_views.summary.filter_transactions',
      eventName: 'Performance Views: Filter transactions table',
      organization_id: parseInt(organization.id, 10),
      value,
    });
    const target = {
      pathname: location.pathname,
      query: {...location.query, showTransactions: value, transactionCursor: undefined},
    };
    browserHistory.push(target);
  };

  handleDiscoverViewClick = () => {
    const {organization} = this.props;
    trackAnalyticsEvent({
      eventKey: 'performance_views.summary.view_in_discover',
      eventName: 'Performance Views: View in Discover from Transaction Summary',
      organization_id: parseInt(organization.id, 10),
    });
  };

  renderTable(eventView: EventView) {
    const {location, organization, transactionName} = this.props;
    const cursor = decodeScalar(location.query?.transactionCursor);

    if (!organization.features.includes('transaction-comparison')) {
      return (
        <DiscoverQuery
          location={location}
          eventView={eventView}
          orgSlug={organization.slug}
          limit={TOP_TRANSACTION_LIMIT}
          cursor={cursor}
        >
          {({isLoading, tableData, pageLinks}) => (
            <React.Fragment>
              <TransactionTable
                organization={organization}
                location={location}
                transactionName={transactionName}
                eventView={eventView}
                tableData={tableData}
                isLoading={isLoading}
                baselineTransaction={null}
              />
              <StyledPagination pageLinks={pageLinks} onCursor={this.handleCursor} />
            </React.Fragment>
          )}
        </DiscoverQuery>
      );
    }

    return (
      <DiscoverQuery
        location={location}
        eventView={eventView}
        orgSlug={organization.slug}
        limit={TOP_TRANSACTION_LIMIT}
        cursor={cursor}
      >
        {({isLoading, tableData, pageLinks}) => (
          <BaselineQuery eventView={eventView} orgSlug={organization.slug}>
            {baselineQueryProps => {
              return (
                <React.Fragment>
                  <TransactionTable
                    organization={organization}
                    location={location}
                    transactionName={transactionName}
                    eventView={eventView}
                    tableData={tableData}
                    isLoading={isLoading || baselineQueryProps.isLoading}
                    baselineTransaction={baselineQueryProps.results}
                  />
                  <StyledPagination pageLinks={pageLinks} onCursor={this.handleCursor} />
                </React.Fragment>
              );
            }}
          </BaselineQuery>
        )}
      </DiscoverQuery>
    );
  }

  render() {
    const {eventView, location, organization, slowDuration} = this.props;
    const {selected, options} = getTransactionSort(location, slowDuration || 0);
    const sortedEventView = eventView.withSorts([selected.sort]);
    if (selected.query) {
      const query = tokenizeSearch(sortedEventView.query);
      selected.query.forEach(item => query.setTagValues(item[0], [item[1]]));
      sortedEventView.query = stringifyQueryObject(query);
    }

    return (
      <React.Fragment>
        <Header>
          <DropdownControl
            data-test-id="filter-transactions"
            label={selected.label}
            buttonProps={{prefix: t('Filter'), size: 'small'}}
          >
            {options.map(({value, label}) => (
              <DropdownItem
                key={value}
                onSelect={this.handleTransactionFilterChange}
                eventKey={value}
                isActive={value === selected.value}
              >
                {label}
              </DropdownItem>
            ))}
          </DropdownControl>
          <HeaderButtonContainer>
            <DiscoverButton
              onClick={this.handleDiscoverViewClick}
              to={sortedEventView.getResultsViewUrlTarget(organization.slug)}
              size="small"
              data-test-id="discover-open"
            >
              {t('Open in Discover')}
            </DiscoverButton>
          </HeaderButtonContainer>
        </Header>
        {this.renderTable(sortedEventView)}
      </React.Fragment>
    );
  }
}

type Props = {
  eventView: EventView;
  location: Location;
  organization: Organization;
  transactionName: string;
  baselineTransaction: BaselineQueryResults | null;

  isLoading: boolean;
  tableData: TableData | null | undefined;
};

class TransactionTable extends React.PureComponent<Props> {
  handleViewDetailsClick = () => {
    const {organization} = this.props;
    trackAnalyticsEvent({
      eventKey: 'performance_views.summary.view_details',
      eventName: 'Performance Views: View Details from Transaction Summary',
      organization_id: parseInt(organization.id, 10),
    });
  };

  handleCellAction = (column: TableColumn<React.ReactText>) => {
    return (action: Actions, value: React.ReactText) => {
      const {eventView, location} = this.props;

      const searchConditions = tokenizeSearch(eventView.query);

      // remove any event.type queries since it is implied to apply to only transactions
      searchConditions.removeTag('event.type');

      // no need to include transaction as its already in the query params
      searchConditions.removeTag('transaction');

      updateQuery(searchConditions, action, column.name, value);

      browserHistory.push({
        pathname: location.pathname,
        query: {
          ...location.query,
          cursor: undefined,
          query: stringifyQueryObject(searchConditions),
        },
      });
    };
  };

  renderHeader() {
    const {eventView, tableData, organization} = this.props;

    const tableMeta = tableData?.meta;
    const columnOrder = eventView.getColumns();
    const generateSortLink = () => undefined;
    const titles = [t('id'), t('user'), t('duration'), t('timestamp')];

    const headerColumns = titles.map((title, index) => (
      <HeaderCell column={columnOrder[index]} tableMeta={tableMeta} key={index}>
        {({align}) => {
          return (
            <HeadCellContainer>
              <SortLink
                align={align}
                title={title}
                direction={undefined}
                canSort={false}
                generateSortLink={generateSortLink}
              />
            </HeadCellContainer>
          );
        }}
      </HeaderCell>
    ));

    // add baseline transaction column

    if (organization.features.includes('transaction-comparison')) {
      headerColumns.push(
        <HeadCellContainer key="baseline">
          <SortLink
            align="right"
            title={t('Compared to Baseline')}
            direction={undefined}
            canSort={false}
            generateSortLink={generateSortLink}
          />
        </HeadCellContainer>
      );
    }

    return headerColumns;
  }

  renderResults() {
    const {isLoading, tableData} = this.props;
    let cells: React.ReactNode[] = [];

    if (isLoading) {
      return cells;
    }
    if (!tableData || !tableData.meta || !tableData.data) {
      return cells;
    }

    const columnOrder = this.props.eventView.getColumns();

    tableData.data.forEach((row, i: number) => {
      // Another check to appease tsc
      if (!tableData.meta) {
        return;
      }
      cells = cells.concat(this.renderRow(row, i, columnOrder, tableData.meta));
    });
    return cells;
  }

  renderRow(
    row: TableDataRow,
    rowIndex: number,
    columnOrder: TableColumn<React.ReactText>[],
    tableMeta: MetaType
  ) {
    const {organization, location, transactionName, baselineTransaction} = this.props;

    const resultsRow = columnOrder.map((column, index) => {
      const field = String(column.key);
      // TODO add a better abstraction for this in fieldRenderers.
      const fieldName = getAggregateAlias(field);
      const fieldType = tableMeta[fieldName];

      const fieldRenderer = getFieldRenderer(field, tableMeta);
      let rendered = fieldRenderer(row, {organization, location});

      const isFirstCell = index === 0;

      if (isFirstCell) {
        // The first column of the row should link to the transaction details view
        const eventSlug = generateEventSlug(row);
        const target = getTransactionDetailsUrl(
          organization,
          eventSlug,
          transactionName,
          location.query
        );

        rendered = (
          <Link
            data-test-id="view-details"
            to={target}
            onClick={this.handleViewDetailsClick}
          >
            {rendered}
          </Link>
        );
      }

      const isNumeric = ['integer', 'number', 'duration'].includes(fieldType);
      const key = `${rowIndex}:${column.key}:${index}`;

      return (
        <BodyCellContainer key={key}>
          <CellAction
            column={column}
            dataRow={row}
            handleCellAction={this.handleCellAction(column)}
          >
            {isNumeric ? (
              <GridCellNumber>{rendered}</GridCellNumber>
            ) : (
              <GridCell>{rendered}</GridCell>
            )}
          </CellAction>
        </BodyCellContainer>
      );
    });

    // add baseline transaction column

    if (organization.features.includes('transaction-comparison')) {
      if (baselineTransaction) {
        const currentTransactionDuration: number =
          Number(row['transaction.duration']) || 0;

        const delta = Math.abs(
          currentTransactionDuration - baselineTransaction['transaction.duration']
        );

        const relativeSpeed =
          currentTransactionDuration < baselineTransaction['transaction.duration']
            ? t('faster')
            : currentTransactionDuration > baselineTransaction['transaction.duration']
            ? t('slower')
            : '';

        const target = getTransactionComparisonUrl({
          organization,
          baselineEventSlug: generateEventSlug(baselineTransaction),
          regressionEventSlug: generateEventSlug(row),
          transaction: transactionName,
          query: location.query,
        });

        resultsRow.push(
          <BodyCellContainer key={`${rowIndex}-baseline`} style={{textAlign: 'right'}}>
            <GridCell>
              <Link to={target} onClick={this.handleViewDetailsClick}>
                {`${getDuration(delta / 1000, delta < 1000 ? 0 : 2)} ${relativeSpeed}`}
              </Link>
            </GridCell>
          </BodyCellContainer>
        );
      } else {
        resultsRow.push(
          <BodyCellContainer key={`${rowIndex}-baseline`}>-</BodyCellContainer>
        );
      }
    }

    return resultsRow;
  }

  render() {
    const {isLoading, tableData} = this.props;

    const hasResults =
      tableData && tableData.data && tableData.meta && tableData.data.length > 0;

    // Custom set the height so we don't have layout shift when results are loaded.
    const loader = <LoadingIndicator style={{margin: '70px auto'}} />;

    return (
      <PanelTable
        isEmpty={!hasResults}
        emptyMessage={t('No transactions found')}
        headers={this.renderHeader()}
        isLoading={isLoading}
        disablePadding
        loader={loader}
      >
        {this.renderResults()}
      </PanelTable>
    );
  }
}

const Header = styled('div')`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin: 0 0 ${space(1)} 0;
`;

const HeaderButtonContainer = styled('div')`
  display: flex;
  flex-direction: row;
`;

const HeadCellContainer = styled('div')`
  padding: ${space(2)};
`;

const BodyCellContainer = styled('div')`
  padding: ${space(1)} ${space(2)};
  ${overflowEllipsis};
`;

const StyledPagination = styled(Pagination)`
  margin: ${space(3)} 0 ${space(4)} 0;
`;

export default TransactionList;
