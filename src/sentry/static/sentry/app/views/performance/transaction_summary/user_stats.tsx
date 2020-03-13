import React from 'react';
import {Location} from 'history';
import styled from '@emotion/styled';

import {Organization} from 'app/types';
import {Client} from 'app/api';
import withApi from 'app/utils/withApi';
import space from 'app/styles/space';
import EventView, {isAPIPayloadSimilar} from 'app/views/eventsV2/eventView';
import {TableData} from 'app/views/eventsV2/table/types';
import {t} from 'app/locale';
import {getFieldRenderer} from 'app/views/eventsV2/utils';
import {assert} from 'app/types/utils';

type Props = {
  location: Location;
  eventView: EventView;
  organization: Organization;
  api: Client;
};

type State = {
  isLoading: boolean;
  tableFetchID: symbol | undefined;
  error: null | string;
  tableData: TableData | null | undefined;
};

class UserStats extends React.Component<Props> {
  state: State = {
    isLoading: true,
    tableFetchID: undefined,
    error: null,

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
      (this.generateUserStatsEventView(prevProps.eventView).isValid() === false &&
        this.generateUserStatsEventView(this.props.eventView).isValid())
    ) {
      this.fetchData();
    }
  }

  generateUserStatsEventView(eventView: EventView): EventView {
    // narrow the search conditions of the Performance Summary event view
    // by modifying the columns to only show user impact and apdex scores

    eventView = eventView.withColumns([
      {
        kind: 'function',
        function: ['apdex', '', undefined],
      },
      {
        kind: 'function',
        function: ['impact', '', undefined],
      },
    ]);

    eventView.sorts = [];

    return eventView;
  }

  shouldRefetchData = (prevProps: Props): boolean => {
    const thisAPIPayload = this.generateUserStatsEventView(
      this.props.eventView
    ).getEventsAPIPayload(this.props.location);
    const otherAPIPayload = this.generateUserStatsEventView(
      prevProps.eventView
    ).getEventsAPIPayload(prevProps.location);

    return !isAPIPayloadSimilar(thisAPIPayload, otherAPIPayload);
  };

  fetchData = () => {
    const {organization, location} = this.props;

    const eventView = this.generateUserStatsEventView(this.props.eventView);

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
        query: {
          ...apiPayload,
          // we only expect one result
          per_page: 1,
        },
      })
      .then(([data, _, _jqXHR]) => {
        if (this.state.tableFetchID !== tableFetchID) {
          // invariant: a different request was initiated after this request
          return;
        }

        this.setState({
          isLoading: false,
          tableFetchID: undefined,
          error: null,
          tableData: data,
        });
      })
      .catch(err => {
        this.setState({
          isLoading: false,
          tableFetchID: undefined,
          error: err.responseJSON.detail,
          tableData: null,
        });
      });
  };

  render() {
    const {tableData, isLoading} = this.state;
    const {organization, location} = this.props;
    const eventView = this.generateUserStatsEventView(this.props.eventView);

    const hasResults =
      tableData && tableData.data && tableData.meta && tableData.data.length > 0;

    if (isLoading || !tableData || !hasResults || !eventView.isValid()) {
      return null;
    }

    const columnOrder = eventView.getColumns();

    assert(tableData.meta);
    const tableMeta = tableData.meta;
    const row = tableData.data[0];

    const stats: {[key: string]: React.ReactNode} = columnOrder.reduce((acc, column) => {
      const field = String(column.key);

      const fieldRenderer = getFieldRenderer(field, tableMeta);

      acc[field] = fieldRenderer(row, {organization, location});

      return acc;
    }, {});

    return (
      <Container>
        <div>
          <StatTitle>{t('User Impact')}</StatTitle>
          <StatNumber>{stats['impact()']}</StatNumber>
        </div>
        <div>
          <StatTitle>{t('Apdex Score')}</StatTitle>
          <StatNumber>{stats['apdex()']}</StatNumber>
        </div>
      </Container>
    );
  }
}

const Container = styled('div')`
  margin-bottom: ${space(4)};
  display: flex;

  color: ${p => p.theme.gray3};

  > * + * {
    margin-left: ${space(4)};
  }
`;

const StatTitle = styled('h4')`
  font-size: ${p => p.theme.fontSizeMedium};

  margin-bottom: ${space(2)};
`;

const StatNumber = styled('div')`
  font-size: 36px;
  line-height: 50px;

  color: ${p => p.theme.gray4};
`;

export default withApi(UserStats);
