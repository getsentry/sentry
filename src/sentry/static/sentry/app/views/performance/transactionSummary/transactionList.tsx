import React from 'react';
import {Location} from 'history';
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
import {TableData, TableDataRow, TableColumn} from 'app/views/eventsV2/table/types';
import HeaderCell from 'app/views/eventsV2/table/headerCell';
import EventView, {MetaType} from 'app/utils/discover/eventView';
import SortLink from 'app/components/gridEditable/sortLink';
import {getFieldRenderer} from 'app/utils/discover/fieldRenderers';
import {getAggregateAlias} from 'app/utils/discover/fields';
import {generateEventSlug} from 'app/utils/discover/urls';
import {trackAnalyticsEvent} from 'app/utils/analytics';
import {decodeScalar} from 'app/utils/queryString';
import DiscoverQuery from 'app/utils/discover/discoverQuery';
import {
  TOP_TRANSACTION_LIMIT,
  TOP_TRANSACTION_FILTERS,
} from 'app/views/performance/constants';

import {GridBodyCell, GridBodyCellNumber, GridHeadCell} from '../styles';
import {getTransactionDetailsUrl} from '../utils';

type WrapperProps = {
  eventView: EventView;
  location: Location;
  organization: Organization;
  transactionName: string;
};

class TransactionList extends React.PureComponent<WrapperProps> {
  getTransactionSort(location: Location) {
    const urlParam = decodeScalar(location.query.showTransactions) || 'slowest';
    const option =
      TOP_TRANSACTION_FILTERS.find(opt => opt.value === urlParam) ||
      TOP_TRANSACTION_FILTERS[0];
    return option;
  }

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
      query: {...location.query, showTransactions: value},
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

  render() {
    const {eventView, location, organization, transactionName} = this.props;
    const activeFilter = this.getTransactionSort(location);
    const sortedEventView = eventView.withSorts([activeFilter.sort]);

    return (
      <React.Fragment>
        <Header>
          <DropdownControl
            data-test-id="filter-transactions"
            label={activeFilter.label}
            buttonProps={{prefix: t('Filter'), size: 'small'}}
          >
            {TOP_TRANSACTION_FILTERS.map(({value, label}) => (
              <DropdownItem
                key={value}
                onSelect={this.handleTransactionFilterChange}
                eventKey={value}
                isActive={value === activeFilter.value}
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
        <DiscoverQuery
          location={location}
          eventView={sortedEventView}
          orgSlug={organization.slug}
          limit={TOP_TRANSACTION_LIMIT}
        >
          {({isLoading, tableData}) => (
            <TransactionTable
              organization={organization}
              location={location}
              transactionName={transactionName}
              eventView={eventView}
              tableData={tableData}
              isLoading={isLoading}
            />
          )}
        </DiscoverQuery>
      </React.Fragment>
    );
  }
}

type Props = {
  eventView: EventView;
  location: Location;
  organization: Organization;
  transactionName: string;

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

  renderHeader() {
    const {eventView, tableData} = this.props;

    const tableMeta = tableData?.meta;
    const columnOrder = eventView.getColumns();
    const generateSortLink = () => undefined;

    return columnOrder.map((column, index) => (
      <HeaderCell column={column} tableMeta={tableMeta} key={index}>
        {({align}) => {
          return (
            <GridHeadCell>
              <SortLink
                align={align}
                title={column.name}
                direction={undefined}
                canSort={false}
                generateSortLink={generateSortLink}
              />
            </GridHeadCell>
          );
        }}
      </HeaderCell>
    ));
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
    const {organization, location, transactionName} = this.props;

    return columnOrder.map((column, index) => {
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
      if (isNumeric) {
        return <GridBodyCellNumber key={key}>{rendered}</GridBodyCellNumber>;
      }

      return <GridBodyCell key={key}>{rendered}</GridBodyCell>;
    });
  }

  render() {
    const {isLoading, tableData} = this.props;

    const hasResults =
      tableData && tableData.data && tableData.meta && tableData.data.length > 0;

    // Custom set the height so we don't have layout shift when results are loaded.
    const loader = <LoadingIndicator style={{margin: '70px auto'}} />;

    return (
      <React.Fragment>
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
      </React.Fragment>
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

export default TransactionList;
