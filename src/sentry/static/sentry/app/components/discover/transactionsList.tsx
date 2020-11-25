import React from 'react';
import {browserHistory} from 'react-router';
import styled from '@emotion/styled';
import {Location, LocationDescriptor, Query} from 'history';

import {Client} from 'app/api';
import DiscoverButton from 'app/components/discoverButton';
import DropdownButton from 'app/components/dropdownButton';
import DropdownControl, {DropdownItem} from 'app/components/dropdownControl';
import SortLink from 'app/components/gridEditable/sortLink';
import Link from 'app/components/links/link';
import LoadingIndicator from 'app/components/loadingIndicator';
import Pagination from 'app/components/pagination';
import PanelTable from 'app/components/panels/panelTable';
import {t} from 'app/locale';
import overflowEllipsis from 'app/styles/overflowEllipsis';
import space from 'app/styles/space';
import {Organization} from 'app/types';
import DiscoverQuery, {TableData, TableDataRow} from 'app/utils/discover/discoverQuery';
import EventView, {MetaType} from 'app/utils/discover/eventView';
import {getFieldRenderer} from 'app/utils/discover/fieldRenderers';
import {getAggregateAlias, Sort} from 'app/utils/discover/fields';
import {decodeScalar} from 'app/utils/queryString';
import HeaderCell from 'app/views/eventsV2/table/headerCell';
import {TableColumn} from 'app/views/eventsV2/table/types';
import {decodeColumnOrder} from 'app/views/eventsV2/utils';
import {GridCell, GridCellNumber} from 'app/views/performance/styles';
import {TrendsEventsDiscoverQuery} from 'app/views/performance/trends/trendsDiscoverQuery';
import {
  TrendChangeType,
  TrendsDataEvents,
  TrendView,
} from 'app/views/performance/trends/types';

const DEFAULT_TRANSACTION_LIMIT = 5;

export type DropdownOption = {
  /**
   * The sort to apply to the eventView when this is selected.
   */
  sort: Sort;
  /**
   * The unique name to use for this option.
   */
  value: string;
  /**
   * The label to display in the dropdown
   */
  label: string;
  /**
   * Included if the option is for a trend
   */
  trendType?: TrendChangeType;
  /**
   * overide the eventView query
   */
  query?: string;
};

type Props = {
  api: Client;
  location: Location;
  eventView: EventView;
  trendView: TrendView;
  organization: Organization;
  /**
   * The currently selected option on the dropdown.
   */
  selected: DropdownOption;
  /**
   * The available options for the dropdown.
   */
  options: DropdownOption[];
  /**
   * The callback for when the dropdown option changes.
   */
  handleDropdownChange: any;
  /**
   * The name of the url parameter that contains the cursor info.
   */
  cursorName: string;
  /**
   * The limit to the number of results to fetch.
   */
  limit: number;
  /**
   * A list of preferred table headers to use over the field names.
   */
  titles?: string[];
  /**
   * Alternate data-test-id to use for the optional links in the first column.
   */
  linkDataTestId?: string;
  /**
   * The callback to generate a link for the first column.
   */
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
    const {eventView, organization, selected, options, handleDropdownChange} = this.props;

    return (
      <Header>
        <DropdownControl
          data-test-id="filter-transactions"
          button={({isOpen, getActorProps}) => (
            <StyledDropdownButton
              {...getActorProps()}
              isOpen={isOpen}
              prefix={t('Filter')}
              size="small"
            >
              {selected.label}
            </StyledDropdownButton>
          )}
        >
          {options.map(({value, label}) => (
            <DropdownItem
              data-test-id={`option-${value}`}
              key={value}
              onSelect={handleDropdownChange}
              eventKey={value}
              isActive={value === selected.value}
            >
              {label}
            </DropdownItem>
          ))}
        </DropdownControl>
        {!this.isTrend() && (
          <HeaderButtonContainer>
            <DiscoverButton
              to={eventView
                .withSorts([selected.sort])
                .getResultsViewUrlTarget(organization.slug)}
              size="small"
              data-test-id="discover-open"
            >
              {t('Open in Discover')}
            </DiscoverButton>
          </HeaderButtonContainer>
        )}
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
      linkDataTestId,
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
              linkDataTestId={linkDataTestId}
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
      trendView,
      location,
      selected,
      organization,
      cursorName,
      linkDataTestId,
      generateFirstLink,
    } = this.props;
    trendView.sorts = [selected.sort];
    trendView.trendType = selected.trendType;
    trendView.query = selected.query || '';
    const cursor = decodeScalar(location.query?.[cursorName]);

    return (
      <TrendsEventsDiscoverQuery
        eventView={trendView}
        orgSlug={organization.slug}
        location={location}
        cursor={cursor}
        limit={5}
      >
        {({isLoading, trendsData, pageLinks}) => (
          <React.Fragment>
            <TransactionsTable
              eventView={trendView}
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
              linkDataTestId={linkDataTestId}
              generateFirstLink={generateFirstLink}
            />
            <StyledPagination
              pageLinks={pageLinks}
              onCursor={this.handleCursor}
              size="small"
            />
          </React.Fragment>
        )}
      </TrendsEventsDiscoverQuery>
    );
  }

  isTrend(): boolean {
    const {selected} = this.props;
    return selected.trendType !== undefined;
  }

  render() {
    return (
      <React.Fragment>
        {this.renderHeader()}
        {this.isTrend() ? this.renderTrendsTable() : this.renderTransactionTable()}
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
  linkDataTestId?: string;
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
  ): React.ReactNode[] {
    const {organization, location, linkDataTestId, generateFirstLink} = this.props;

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
            <Link data-test-id={linkDataTestId ?? 'transactions-list-link'} to={target}>
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

const StyledDropdownButton = styled(DropdownButton)`
  min-width: 145px;
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
