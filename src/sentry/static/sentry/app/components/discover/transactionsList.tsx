import React from 'react';
import {browserHistory} from 'react-router';
import styled from '@emotion/styled';
import {Location, LocationDescriptor, Query} from 'history';

import GuideAnchor from 'app/components/assistant/guideAnchor';
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
import {fieldAlignment, getAggregateAlias, Sort} from 'app/utils/discover/fields';
import {generateEventSlug} from 'app/utils/discover/urls';
import {getDuration} from 'app/utils/formatters';
import BaselineQuery, {
  BaselineQueryResults,
} from 'app/utils/performance/baseline/baselineQuery';
import {TrendsEventsDiscoverQuery} from 'app/utils/performance/trends/trendsDiscoverQuery';
import {decodeScalar} from 'app/utils/queryString';
import {stringifyQueryObject, tokenizeSearch} from 'app/utils/tokenizeSearch';
import CellAction, {Actions} from 'app/views/eventsV2/table/cellAction';
import {TableColumn} from 'app/views/eventsV2/table/types';
import {decodeColumnOrder} from 'app/views/eventsV2/utils';
import {GridCell, GridCellNumber} from 'app/views/performance/styles';
import {
  TrendChangeType,
  TrendsDataEvents,
  TrendView,
} from 'app/views/performance/trends/types';
import {getTransactionComparisonUrl} from 'app/views/performance/utils';

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
  query?: [string, string][];
};

type Props = {
  location: Location;
  eventView: EventView;
  trendView?: TrendView;
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
  handleDropdownChange: (k: string) => void;
  /**
   * The callback to generate a cell action handler for a column
   */
  handleCellAction?: (
    c: TableColumn<React.ReactText>
  ) => (a: Actions, v: React.ReactText) => void;
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
   * A map of callbacks to generate a link for a column based on the title.
   */
  generateLink?: Record<
    string,
    (
      organization: Organization,
      tableRow: TableDataRow,
      query: Query
    ) => LocationDescriptor
  >;
  /**
   * The name of the transaction to find a baseline for.
   */
  baseline?: string;
  /**
   * The callback for when a baseline cell is clicked.
   */
  handleBaselineClick?: (e: React.MouseEvent<Element>) => void;
  /**
   * The callback for when Open in Discover is clicked.
   */
  handleOpenInDiscoverClick?: (e: React.MouseEvent<Element>) => void;
  /**
   * Show a loading indicator instead of the table, used for transaction summary p95.
   */
  forceLoading?: boolean;
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
      selected,
      options,
      handleDropdownChange,
      handleOpenInDiscoverClick,
    } = this.props;

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
            <GuideAnchor target="release_transactions_open_in_discover">
              <DiscoverButton
                onClick={handleOpenInDiscoverClick}
                to={eventView
                  .withSorts([selected.sort])
                  .getResultsViewUrlTarget(organization.slug)}
                size="small"
                data-test-id="discover-open"
              >
                {t('Open in Discover')}
              </DiscoverButton>
            </GuideAnchor>
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
      handleCellAction,
      cursorName,
      limit,
      titles,
      generateLink,
      baseline,
      forceLoading,
    } = this.props;
    const sortedEventView = eventView.withSorts([selected.sort]);
    const columnOrder = sortedEventView.getColumns();
    const cursor = decodeScalar(location.query?.[cursorName]);
    if (selected.query) {
      const query = tokenizeSearch(sortedEventView.query);
      selected.query.forEach(item => query.setTagValues(item[0], [item[1]]));
      sortedEventView.query = stringifyQueryObject(query);
    }

    const baselineTransactionName = organization.features.includes(
      'transaction-comparison'
    )
      ? baseline ?? null
      : null;

    let tableRenderer = ({isLoading, pageLinks, tableData, baselineData}) => (
      <React.Fragment>
        <TransactionsTable
          eventView={sortedEventView}
          organization={organization}
          location={location}
          isLoading={isLoading}
          tableData={tableData}
          baselineData={baselineData ?? null}
          columnOrder={columnOrder}
          titles={titles}
          generateLink={generateLink}
          baselineTransactionName={baselineTransactionName}
          handleCellAction={handleCellAction}
        />
        <StyledPagination
          pageLinks={pageLinks}
          onCursor={this.handleCursor}
          size="small"
        />
      </React.Fragment>
    );

    if (forceLoading) {
      return tableRenderer({
        isLoading: true,
        pageLinks: null,
        tableData: null,
        baselineData: null,
      });
    }

    if (baselineTransactionName) {
      const orgTableRenderer = tableRenderer;
      tableRenderer = ({isLoading, pageLinks, tableData}) => (
        <BaselineQuery eventView={eventView} orgSlug={organization.slug}>
          {baselineQueryProps => {
            return orgTableRenderer({
              isLoading: isLoading || baselineQueryProps.isLoading,
              pageLinks,
              tableData,
              baselineData: baselineQueryProps.results,
            });
          }}
        </BaselineQuery>
      );
    }

    return (
      <DiscoverQuery
        location={location}
        eventView={sortedEventView}
        orgSlug={organization.slug}
        limit={limit}
        cursor={cursor}
      >
        {tableRenderer}
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
      generateLink,
    } = this.props;

    const sortedEventView: TrendView = trendView!.clone();
    sortedEventView.sorts = [selected.sort];
    sortedEventView.trendType = selected.trendType;
    if (selected.query) {
      const query = tokenizeSearch(sortedEventView.query);
      selected.query.forEach(item => query.setTagValues(item[0], [item[1]]));
      sortedEventView.query = stringifyQueryObject(query);
    }
    const cursor = decodeScalar(location.query?.[cursorName]);

    return (
      <TrendsEventsDiscoverQuery
        eventView={sortedEventView}
        orgSlug={organization.slug}
        location={location}
        cursor={cursor}
        limit={5}
      >
        {({isLoading, trendsData, pageLinks}) => (
          <React.Fragment>
            <TransactionsTable
              eventView={sortedEventView}
              organization={organization}
              location={location}
              isLoading={isLoading}
              tableData={trendsData}
              baselineData={null}
              titles={['transaction', 'percentage', 'difference']}
              columnOrder={decodeColumnOrder([
                {field: 'transaction'},
                {field: 'trend_percentage()'},
                {field: 'trend_difference()'},
              ])}
              generateLink={generateLink}
              baselineTransactionName={null}
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
  tableData: TableData | TrendsDataEvents | null;
  columnOrder: TableColumn<React.ReactText>[];
  titles?: string[];
  baselineTransactionName: string | null;
  baselineData: BaselineQueryResults | null;
  handleBaselineClick?: (e: React.MouseEvent<Element>) => void;
  generateLink?: Record<
    string,
    (
      organization: Organization,
      tableRow: TableDataRow,
      query: Query
    ) => LocationDescriptor
  >;
  handleCellAction?: (
    c: TableColumn<React.ReactText>
  ) => (a: Actions, v: React.ReactText) => void;
};

class TransactionsTable extends React.PureComponent<TableProps> {
  getTitles() {
    const {eventView, titles} = this.props;
    return titles ?? eventView.getFields();
  }

  renderHeader() {
    const {tableData, columnOrder, baselineTransactionName} = this.props;

    const tableMeta = tableData?.meta;
    const generateSortLink = () => undefined;
    const tableTitles = this.getTitles();

    const headers = tableTitles.map((title, index) => {
      const column = columnOrder[index];
      const align = fieldAlignment(column.name, column.type, tableMeta);
      return (
        <HeadCellContainer key={index}>
          <SortLink
            align={align}
            title={title}
            direction={undefined}
            canSort={false}
            generateSortLink={generateSortLink}
          />
        </HeadCellContainer>
      );
    });

    if (baselineTransactionName) {
      headers.push(
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

    return headers;
  }

  renderRow(
    row: TableDataRow,
    rowIndex: number,
    columnOrder: TableColumn<React.ReactText>[],
    tableMeta: MetaType
  ): React.ReactNode[] {
    const {
      eventView,
      organization,
      location,
      generateLink,
      baselineTransactionName,
      baselineData,
      handleBaselineClick,
      handleCellAction,
    } = this.props;
    const fields = eventView.getFields();

    const resultsRow = columnOrder.map((column, index) => {
      const field = String(column.key);
      // TODO add a better abstraction for this in fieldRenderers.
      const fieldName = getAggregateAlias(field);
      const fieldType = tableMeta[fieldName];

      const fieldRenderer = getFieldRenderer(field, tableMeta);
      let rendered = fieldRenderer(row, {organization, location});

      const target = generateLink?.[field]?.(organization, row, location.query);

      if (target) {
        rendered = (
          <Link data-test-id={`view-${fields[index]}`} to={target}>
            {rendered}
          </Link>
        );
      }

      const isNumeric = ['integer', 'number', 'duration'].includes(fieldType);
      const key = `${rowIndex}:${column.key}:${index}`;
      rendered = isNumeric ? (
        <GridCellNumber>{rendered}</GridCellNumber>
      ) : (
        <GridCell>{rendered}</GridCell>
      );

      if (handleCellAction) {
        rendered = (
          <CellAction
            column={column}
            dataRow={row}
            handleCellAction={handleCellAction(column)}
          >
            {rendered}
          </CellAction>
        );
      }

      return <BodyCellContainer key={key}>{rendered}</BodyCellContainer>;
    });

    if (baselineTransactionName) {
      if (baselineData) {
        const currentTransactionDuration: number =
          Number(row['transaction.duration']) || 0;
        const duration = baselineData['transaction.duration'];

        const delta = Math.abs(currentTransactionDuration - duration);

        const relativeSpeed =
          currentTransactionDuration < duration
            ? t('faster')
            : currentTransactionDuration > duration
            ? t('slower')
            : '';

        const target = getTransactionComparisonUrl({
          organization,
          baselineEventSlug: generateEventSlug(baselineData),
          regressionEventSlug: generateEventSlug(row),
          transaction: baselineTransactionName,
          query: location.query,
        });

        resultsRow.push(
          <BodyCellContainer
            data-test-id="baseline-cell"
            key={`${rowIndex}-baseline`}
            style={{textAlign: 'right'}}
          >
            <GridCell>
              <Link to={target} onClick={handleBaselineClick}>
                {`${getDuration(delta / 1000, delta < 1000 ? 0 : 2)} ${relativeSpeed}`}
              </Link>
            </GridCell>
          </BodyCellContainer>
        );
      } else {
        resultsRow.push(
          <BodyCellContainer data-test-id="baseline-cell" key={`${rowIndex}-baseline`}>
            {'\u2014'}
          </BodyCellContainer>
        );
      }
    }

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
