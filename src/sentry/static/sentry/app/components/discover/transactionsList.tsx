import React from 'react';
import {Location, LocationDescriptor, Query} from 'history';
import {browserHistory} from 'react-router';
import styled from '@emotion/styled';

import {Client} from 'app/api';
import {t} from 'app/locale';
import DiscoverButton from 'app/components/discoverButton';
import DropdownControl, {DropdownItem} from 'app/components/dropdownControl';
import SortLink from 'app/components/gridEditable/sortLink';
import Link from 'app/components/links/link';
import LoadingIndicator from 'app/components/loadingIndicator';
import Pagination from 'app/components/pagination';
import PanelTable from 'app/components/panels/panelTable';
import overflowEllipsis from 'app/styles/overflowEllipsis';
import space from 'app/styles/space';
import {GlobalSelection, Organization} from 'app/types';
import DiscoverQuery, {TableData, TableDataRow} from 'app/utils/discover/discoverQuery';
import TrendsDiscoverQuery from 'app/views/performance/trends/trendsDiscoverQuery';
import {
  TrendChangeType,
  TrendView,
  TrendsDataEvents,
} from 'app/views/performance/trends/types';
import {decodeColumnOrder} from 'app/views/eventsV2/utils';
import EventView, {MetaType} from 'app/utils/discover/eventView';
import {Sort, getAggregateAlias} from 'app/utils/discover/fields';
import {getFieldRenderer} from 'app/utils/discover/fieldRenderers';
import {decodeScalar} from 'app/utils/queryString';
import HeaderCell from 'app/views/eventsV2/table/headerCell';
import {TableColumn} from 'app/views/eventsV2/table/types';
import {GridCell, GridCellNumber} from 'app/views/performance/styles';

const DEFAULT_TRANSACTION_LIMIT = 5;

export type DropdownOption = {
  sort: Sort;
  value: string;
  label: string;
};

type Props = {
  api: Client;
  location: Location;
  eventView: EventView;
  organization: Organization;
  dropdownTitle: string;
  selection: GlobalSelection;
  selected: DropdownOption;
  options: DropdownOption[];
  handleDropdownChange: any;
  cursorName: string;
  limit: number;
  trends: boolean;
  titles?: string[];
  dataTestId?: string;
  generateFirstLink?: (
    organization: Organization,
    tableRow: TableDataRow,
    query: Query
  ) => LocationDescriptor;
};

class TransactionsList extends React.Component<Props> {
  static defaultProps = {
    cursorName: 'transactionCursor',
    limit: DEFAULT_TRANSACTION_LIMIT,
  };

  handleCursor = (cursor: string, pathname: string, query: Query) => {
    const {cursorName} = this.props;
    browserHistory.push({
      pathname,
      query: {...query, [cursorName]: cursor},
    });
  };

  renderHeader(): React.ReactNode {
    const {
      eventView,
      organization,
      dropdownTitle,
      selected,
      options,
      handleDropdownChange,
    } = this.props;
    const sortedEventView = eventView.withSorts([selected.sort]);

    return (
      <Header>
        <DropdownControl
          data-test-id="filter-transactions"
          label={selected.label}
          buttonProps={{prefix: dropdownTitle, size: 'small'}}
        >
          {options.map(({value, label}) => (
            <DropdownItem
              key={value}
              onSelect={handleDropdownChange}
              eventKey={value}
              isActive={value === selected.value}
            >
              {label}
            </DropdownItem>
          ))}
        </DropdownControl>
        <HeaderButtonContainer>
          <DiscoverButton
            to={sortedEventView.getResultsViewUrlTarget(organization.slug)}
            size="small"
            data-test-id="discover-open"
          >
            {t('Open in Discover')}
          </DiscoverButton>
        </HeaderButtonContainer>
      </Header>
    );
  }

  renderTransactionTable(): React.ReactNode {
    const {
      eventView,
      location,
      organization,
      selected,
      cursorName,
      limit,
      titles,
      dataTestId,
      generateFirstLink,
    } = this.props;
    const sortedEventView = eventView.withSorts([selected.sort]);
    const columnOrder = sortedEventView.getColumns();
    const cursor = decodeScalar(location.query?.[cursorName]);

    return (
      <DiscoverQuery
        location={location}
        eventView={sortedEventView}
        orgSlug={organization.slug}
        limit={limit}
        cursor={cursor}
      >
        {({isLoading, tableData, pageLinks}) => (
          <React.Fragment>
            <TransactionsTable
              eventView={sortedEventView}
              organization={organization}
              location={location}
              isLoading={isLoading}
              tableData={tableData}
              columnOrder={columnOrder}
              titles={titles}
              dataTestId={dataTestId}
              generateFirstLink={generateFirstLink}
            />
            <StyledPagination
              pageLinks={pageLinks}
              onCursor={this.handleCursor}
              size="small"
            />
          </React.Fragment>
        )}
      </DiscoverQuery>
    );
  }

  renderTrendsTable(): React.ReactNode {
    const {
      eventView,
      location,
      organization,
      cursorName,
      dataTestId,
      generateFirstLink,
    } = this.props;
    eventView.fields = [{field: 'transaction'}];
    const trendView = eventView.withSorts(['trend_percentage']) as TrendView;
    trendView.trendType = 'regression';
    const cursor = decodeScalar(location.query?.[cursorName]);

    return (
      <TrendsDiscoverQuery
        route="events-trends"
        eventView={trendView}
        orgSlug={organization.slug}
        location={location}
        trendChangeType={TrendChangeType.REGRESSION}
        cursor={cursor}
        limit={5}
      >
        {({isLoading, trendsData, pageLinks}) => (
          <React.Fragment>
            <TransactionsTable
              eventView={eventView}
              organization={organization}
              location={location}
              isLoading={isLoading}
              tableData={trendsData}
              titles={['transaction', 'percentage', 'difference']}
              columnOrder={decodeColumnOrder([
                {field: 'transaction'},
                {field: 'trend_percentage()'},
                {field: 'trend_difference()'},
              ])}
              dataTestId={dataTestId}
              generateFirstLink={generateFirstLink}
            />
            <StyledPagination
              pageLinks={pageLinks}
              onCursor={this.handleCursor}
              size="small"
            />
          </React.Fragment>
        )}
      </TrendsDiscoverQuery>
    );
  }

  render() {
    const {trends} = this.props;
    return (
      <React.Fragment>
        {this.renderHeader()}
        {trends ? this.renderTrendsTable() : this.renderTransactionTable()}
      </React.Fragment>
    );
  }
}

type TableProps = {
  eventView: EventView;
  organization: Organization;
  location: Location;
  isLoading: boolean;
  tableData: TableData | TrendsDataEvents | null | undefined;
  columnOrder: TableColumn<React.ReactText>[];
  titles?: string[];
  dataTestId?: string;
  generateFirstLink?: (
    organization: Organization,
    tableRow: TableDataRow,
    query: Query
  ) => LocationDescriptor;
};

class TransactionsTable extends React.PureComponent<TableProps> {
  renderHeader() {
    const {eventView, tableData, titles, columnOrder} = this.props;

    const tableMeta = tableData?.meta;
    const generateSortLink = () => undefined;
    const tableTitles = titles ?? eventView.getFields().map(field => t(field));

    return tableTitles.map((title, index) => (
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
  }

  renderRow(
    row: TableDataRow,
    rowIndex: number,
    columnOrder: TableColumn<React.ReactText>[],
    tableMeta: MetaType
  ) {
    const {organization, location, dataTestId, generateFirstLink} = this.props;

    const resultsRow = columnOrder.map((column, index) => {
      const field = String(column.key);
      // TODO add a better abstraction for this in fieldRenderers.
      const fieldName = getAggregateAlias(field);
      const fieldType = tableMeta[fieldName];

      const fieldRenderer = getFieldRenderer(field, tableMeta);
      let rendered = fieldRenderer(row, {organization, location});

      if (generateFirstLink) {
        const isFirstCell = index === 0;

        if (isFirstCell) {
          const target = generateFirstLink(organization, row, location.query);
          rendered = (
            <Link data-test-id={dataTestId ?? 'transactions-list-link'} to={target}>
              {rendered}
            </Link>
          );
        }
      }

      const isNumeric = ['integer', 'number', 'duration'].includes(fieldType);
      const key = `${rowIndex}:${column.key}:${index}`;

      return (
        <BodyCellContainer key={key}>
          {isNumeric ? (
            <GridCellNumber>{rendered}</GridCellNumber>
          ) : (
            <GridCell>{rendered}</GridCell>
          )}
        </BodyCellContainer>
      );
    });

    return resultsRow;
  }

  renderResults() {
    const {isLoading, tableData, columnOrder} = this.props;
    let cells: React.ReactNode[] = [];

    if (isLoading) {
      return cells;
    }
    if (!tableData || !tableData.meta || !tableData.data) {
      return cells;
    }

    tableData.data.forEach((row, i: number) => {
      // Another check to appease tsc
      if (!tableData.meta) {
        return;
      }
      cells = cells.concat(this.renderRow(row, i, columnOrder, tableData.meta));
    });
    return cells;
  }

  render() {
    const {isLoading, tableData} = this.props;

    const hasResults =
      tableData && tableData.data && tableData.meta && tableData.data.length > 0;

    // Custom set the height so we don't have layout shift when results are loaded.
    const loader = <LoadingIndicator style={{margin: '70px auto'}} />;

    return (
      <StyledPanelTable
        isEmpty={!hasResults}
        emptyMessage={t('No transactions found')}
        headers={this.renderHeader()}
        isLoading={isLoading}
        disablePadding
        loader={loader}
      >
        {this.renderResults()}
      </StyledPanelTable>
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

const StyledPanelTable = styled(PanelTable)`
  margin-bottom: ${space(1)};
`;

const HeadCellContainer = styled('div')`
  padding: ${space(2)};
`;

const BodyCellContainer = styled('div')`
  padding: ${space(1)} ${space(2)};
  ${overflowEllipsis};
`;

const StyledPagination = styled(Pagination)`
  margin: 0 0 ${space(3)} 0;
`;

export default TransactionsList;
