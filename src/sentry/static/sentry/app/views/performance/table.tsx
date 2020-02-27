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
import {Panel, PanelHeader, PanelItem} from 'app/components/panels';
import LoadingIndicator from 'app/components/loadingIndicator';
import EmptyStateWarning from 'app/components/emptyStateWarning';
import Pagination from 'app/components/pagination';
import Link from 'app/components/links/link';
import EventView, {isAPIPayloadSimilar, Field} from 'app/views/eventsV2/eventView';
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

        this.setState(prevState => {
          return {
            isLoading: false,
            tableFetchID: undefined,
            error: null,
            pageLinks: jqXHR ? jqXHR.getResponseHeader('Link') : prevState.pageLinks,
            tableData: data,
          };
        });
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
        <SpanEntireRow>
          <LoadingIndicator />
        </SpanEntireRow>
      );
    }

    const hasResults =
      tableData && tableData.data && tableData.meta && tableData.data.length > 0;

    if (!hasResults) {
      return (
        <SpanEntireRow>
          <EmptyStateWarning>
            <p>{t('No transactions found')}</p>
          </EmptyStateWarning>
        </SpanEntireRow>
      );
    }

    assert(tableData);

    const columnOrder = this.props.eventView.getColumns();

    const lastIndex = tableData.data.length - 1;
    return tableData.data.map((row, index) => {
      assert(tableData.meta);

      const isLastRow = index === lastIndex;
      return (
        <React.Fragment key={index}>
          {this.renderRowItem(row, columnOrder, tableData.meta, isLastRow)}
        </React.Fragment>
      );
    });
  };

  renderRowItem = (
    row: TableDataRow,
    columnOrder: TableColumn<React.ReactText>[],
    tableMeta: MetaType,
    isLastRow: boolean
  ) => {
    const {organization, location, eventView} = this.props;

    const lastIndex = columnOrder.length - 1;
    return columnOrder.map((column, index) => {
      const field = String(column.key);
      const fieldName = getAggregateAlias(field);
      const fieldType = tableMeta[fieldName];

      const fieldRenderer = getFieldRenderer(field, tableMeta);
      let rendered = fieldRenderer(row, {organization, location});

      const isFirstCell = index === 0;
      const isLastCell = index === lastIndex;

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
        return (
          <BodyCell
            key={column.key}
            first={isFirstCell}
            last={isLastCell}
            hideBottomBorder={isLastRow}
          >
            <NumericColumn>{rendered}</NumericColumn>
          </BodyCell>
        );
      }

      return (
        <BodyCell
          key={column.key}
          first={isFirstCell}
          last={isLastCell}
          hideBottomBorder={isLastRow}
        >
          {rendered}
        </BodyCell>
      );
    });
  };

  generateSortLink = (field: Field, tableDataMeta?: MetaType) => ():
    | LocationDescriptorObject
    | undefined => {
    const {eventView} = this.props;

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
  };

  renderHeader = () => {
    const {location, eventView} = this.props;
    const {tableData} = this.state;

    const tableDataMeta = tableData && tableData.meta ? tableData.meta : undefined;

    const columnOrder = this.props.eventView.getColumns();

    const lastindex = columnOrder.length - 1;
    return columnOrder.map((column, index) => {
      return (
        <HeaderCell column={column} tableData={tableData} key={index}>
          {({align}) => {
            const field = column.eventViewField;

            return (
              <HeadCell first={index === 0} last={lastindex === index}>
                <SortLink
                  align={align}
                  field={field}
                  location={location}
                  eventView={eventView}
                  tableDataMeta={tableDataMeta}
                  getTarget={this.generateSortLink(field, tableDataMeta)}
                />
              </HeadCell>
            );
          }}
        </HeaderCell>
      );
    });
  };

  render() {
    return (
      <div>
        <Panel>
          <TableGrid>
            {this.renderHeader()}
            {this.renderResults()}
          </TableGrid>
        </Panel>
        <Pagination pageLinks={this.state.pageLinks} />
      </div>
    );
  }
}

const TableGrid = styled('div')`
  display: grid;
  grid-template-columns: auto repeat(7, minmax(50px, max-content));
  width: 100%;
`;

const HeadCell = styled(PanelHeader)<{first?: boolean; last?: boolean}>`
  background-color: ${p => p.theme.offWhite};

  display: block;
  text-overflow: ellipsis;

  padding: ${props => {
    /* top | right | bottom | left */

    if (props.first) {
      return `${space(2)} ${space(1)} ${space(2)} ${space(2)}`;
    }

    if (props.last) {
      return `${space(2)} ${space(2)} ${space(2)} ${space(1)}`;
    }

    return `${space(2)} ${space(1)} ${space(2)} ${space(1)}`;
  }};
`;

const BodyCell = styled(PanelItem)<{
  first?: boolean;
  last?: boolean;
  hideBottomBorder: boolean;
}>`
  display: block;
  text-overflow: ellipsis;

  padding: ${props => {
    /* top | right | bottom | left */

    if (props.first) {
      return `${space(2)} ${space(1)} ${space(2)} ${space(2)}`;
    }

    if (props.last) {
      return `${space(2)} ${space(2)} ${space(2)} ${space(1)}`;
    }

    return `${space(2)} ${space(1)} ${space(2)} ${space(1)}`;
  }};

  ${props => {
    if (props.hideBottomBorder) {
      return 'border-bottom: none';
    }

    return null;
  }};
`;

const SpanEntireRow = styled('div')`
  grid-column: 1 / -1;
`;

const NumericColumn = styled('div')`
  text-align: right;
`;

export default withApi(Table);
