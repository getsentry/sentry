import React from 'react';
import {Location, LocationDescriptorObject} from 'history';
import styled from '@emotion/styled';
import omit from 'lodash/omit';

import {t} from 'app/locale';
import {Organization} from 'app/types';
import {assert} from 'app/types/utils';
import {Client} from 'app/api';
import withApi from 'app/utils/withApi';
import space from 'app/styles/space';
import {Panel} from 'app/components/panels';
import LoadingIndicator from 'app/components/loadingIndicator';
import EmptyStateWarning from 'app/components/emptyStateWarning';
import Pagination from 'app/components/pagination';
import overflowEllipsis from 'app/styles/overflowEllipsis';
import Link from 'app/components/links/link';
import EventView, {isAPIPayloadSimilar} from 'app/views/eventsV2/eventView';
import SortLink from 'app/views/eventsV2/sortLink';
import {TableData, TableDataRow, TableColumn} from 'app/views/eventsV2/table/types';
import HeaderCell from 'app/views/eventsV2/table/headerCell';
import {getFieldRenderer, MetaType, getAggregateAlias} from 'app/views/eventsV2/utils';
import {
  generateEventSlug,
  eventDetailsRouteWithEventView,
} from 'app/views/eventsV2/eventDetails/utils';

type Props = {
  api: Client;
  eventView: EventView;
  organization: Organization;
  location: Location;
  setError: (msg: string | undefined) => void;
};

type State = {
  isLoading: boolean;
  tableFetchID: symbol | undefined;
  error: null | string;
  pageLinks: null | string;
  tableData: TableData | null | undefined;
};

class Table extends React.Component<Props, State> {
  state: State = {
    isLoading: true,
    tableFetchID: undefined,
    error: null,

    pageLinks: null,
    tableData: null,
  };

  componentDidMount() {
    this.fetchData();
  }

  componentDidUpdate(prevProps: Props) {
    // Reload data if we aren't already loading, or if we've moved
    // from an invalid view state to a valid one.
    if (
      (!this.state.isLoading && this.shouldRefetchData(prevProps)) ||
      (prevProps.eventView.isValid() === false && this.props.eventView.isValid())
    ) {
      this.fetchData();
    }
  }

  shouldRefetchData = (prevProps: Props): boolean => {
    const thisAPIPayload = this.props.eventView.getEventsAPIPayload(this.props.location);
    const otherAPIPayload = prevProps.eventView.getEventsAPIPayload(prevProps.location);

    return !isAPIPayloadSimilar(thisAPIPayload, otherAPIPayload);
  };

  fetchData = () => {
    const {eventView, organization, location, setError} = this.props;

    if (!eventView.isValid()) {
      return;
    }

    const url = `/organizations/${organization.slug}/eventsv2/`;
    const tableFetchID = Symbol('tableFetchID');
    const apiPayload = eventView.getEventsAPIPayload(location);

    this.setState({isLoading: true, tableFetchID});

    this.props.api
      .requestPromise(url, {
        method: 'GET',
        includeAllArgs: true,
        query: apiPayload,
      })
      .then(([data, _, jqXHR]) => {
        if (this.state.tableFetchID !== tableFetchID) {
          // invariant: a different request was initiated after this request
          return;
        }

        this.setState(prevState => ({
          isLoading: false,
          tableFetchID: undefined,
          error: null,
          pageLinks: jqXHR ? jqXHR.getResponseHeader('Link') : prevState.pageLinks,
          tableData: data,
        }));
      })
      .catch(err => {
        this.setState({
          isLoading: false,
          tableFetchID: undefined,
          error: err.responseJSON.detail,
          pageLinks: null,
          tableData: null,
        });
        setError(err.responseJSON.detail);
      });
  };

  renderResults = () => {
    const {isLoading, tableData} = this.state;

    if (isLoading) {
      return (
        <tr>
          <td colSpan={8}>
            <LoadingIndicator />
          </td>
        </tr>
      );
    }

    const hasResults =
      tableData && tableData.data && tableData.meta && tableData.data.length > 0;

    if (!hasResults) {
      return (
        <tr>
          <td colSpan={8}>
            <EmptyStateWarning>
              <p>{t('No transactions found')}</p>
            </EmptyStateWarning>
          </td>
        </tr>
      );
    }

    assert(tableData);

    const columnOrder = this.props.eventView.getColumns();

    return tableData.data.map((row, index) => {
      assert(tableData.meta);

      return (
        <React.Fragment key={index}>
          <GridRow>{this.renderRowItem(row, columnOrder, tableData.meta)}</GridRow>
        </React.Fragment>
      );
    });
  };

  renderRowItem = (
    row: TableDataRow,
    columnOrder: TableColumn<React.ReactText>[],
    tableMeta: MetaType
  ) => {
    const {organization, location, eventView} = this.props;

    return columnOrder.map((column, index) => {
      const field = String(column.key);
      const fieldName = getAggregateAlias(field);
      const fieldType = tableMeta[fieldName];

      const fieldRenderer = getFieldRenderer(field, tableMeta);
      let rendered = fieldRenderer(row, {organization, location});

      const isFirstCell = index === 0;

      if (isFirstCell) {
        // the first column of the row should link to the transaction details view
        // on Discover

        const eventSlug = generateEventSlug(row);

        const target = eventDetailsRouteWithEventView({
          orgSlug: organization.slug,
          eventSlug,
          eventView,
        });

        rendered = <Link to={target}>{rendered}</Link>;
      }

      const isNumeric = ['integer', 'number', 'duration'].includes(fieldType);
      if (isNumeric) {
        return <GridBodyCellNumber key={column.key}>{rendered}</GridBodyCellNumber>;
      }

      return <GridBodyCell key={column.key}>{rendered}</GridBodyCell>;
    });
  };

  renderHeader = () => {
    const {location, eventView} = this.props;
    const {tableData} = this.state;

    const tableDataMeta = tableData && tableData.meta ? tableData.meta : undefined;

    return eventView.getColumns().map((column, index) => (
      <HeaderCell column={column} tableData={tableData} key={index}>
        {({align}) => {
          const field = eventView.fields[index];

          function generateSortLink(): LocationDescriptorObject | undefined {
            if (!tableDataMeta) {
              return undefined;
            }

            const nextEventView = eventView.sortOnField(field, tableDataMeta);
            const queryStringObject = nextEventView.generateQueryStringObject();

            const omitKeys = ['widths', 'query', 'name', 'field'];

            return {
              ...location,
              query: omit(queryStringObject, omitKeys),
            };
          }

          return (
            <GridHeadCell>
              <SortLink
                align={align}
                field={field}
                eventView={eventView}
                tableDataMeta={tableDataMeta}
                generateSortLink={generateSortLink}
              />
            </GridHeadCell>
          );
        }}
      </HeaderCell>
    ));
  };

  render() {
    return (
      <div>
        <Panel>
          <TableGrid>
            <GridHead>
              <GridRow>{this.renderHeader()}</GridRow>
            </GridHead>
            <GridBody>{this.renderResults()}</GridBody>
          </TableGrid>
        </Panel>
        <Pagination pageLinks={this.state.pageLinks} />
      </div>
    );
  }
}

const TableGrid = styled('table')`
  margin: 0;
  width: 100%;
`;

const GridHead = styled('thead')`
  color: ${p => p.theme.gray3};
  text-transform: uppercase;
  font-size: 12px;
  line-height: 1;
`;

const GridHeadCell = styled('th')`
  padding: ${space(2)};
  background: ${p => p.theme.offWhite};
  ${overflowEllipsis};

  &:first-child {
    border-top-left-radius: ${p => p.theme.borderRadius};
  }

  &:last-child {
    border-top-right-radius: ${p => p.theme.borderRadius};
  }
`;

const GridBody = styled('tbody')`
  font-size: 14px;
`;

const GridBodyCell = styled('td')`
  border-top: 1px solid ${p => p.theme.borderDark};
  padding: ${space(1)} ${space(2)};
  ${overflowEllipsis};
`;

const GridBodyCellNumber = styled(GridBodyCell)`
  text-align: right;
`;

const GridRow = styled('tr')`
  display: grid;
  grid-template-columns: auto 120px repeat(6, minmax(70px, 120px));
`;

export default withApi(Table);
