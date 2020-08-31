import React from 'react';
import isEqual from 'lodash/isEqual';

import {Client} from 'app/api';
import withApi from 'app/utils/withApi';
import EventView from 'app/utils/discover/eventView';

export type BaselineQueryResults = {
  'transaction.duration': number;
  // event id of the transaction chosen to be the baseline transaction
  id: string;
  project: string;
};

type ChildrenProps = {
  isLoading: boolean;
  error: null | string;
  results: null | BaselineQueryResults;
};

type Props = {
  api: Client;
  eventView: EventView;
  orgSlug: string;

  children: (props: ChildrenProps) => React.ReactNode;
};

type State = {
  fetchID: symbol | undefined;
} & ChildrenProps;

class BaselineQuery extends React.PureComponent<Props> {
  state: State = {
    isLoading: true,
    fetchID: undefined,
    error: null,

    results: null,
  };

  componentDidMount() {
    this.fetchData();
  }

  componentDidUpdate(prevProps: Props) {
    // Reload data if we aren't already loading,
    const refetchCondition = !this.state.isLoading && this.shouldRefetchData(prevProps);

    if (refetchCondition) {
      this.fetchData();
    }
  }

  generatePayload(eventView: EventView) {
    return {
      ...eventView.getGlobalSelectionQuery(),
      query: eventView.query,
    };
  }

  shouldRefetchData = (prevProps: Props): boolean => {
    const thisAPIPayload = this.generatePayload(this.props.eventView);
    const otherAPIPayload = this.generatePayload(prevProps.eventView);

    return !isEqual(thisAPIPayload, otherAPIPayload);
  };

  fetchData = () => {
    const {eventView, orgSlug} = this.props;

    if (!eventView.isValid()) {
      return;
    }

    const url = `/organizations/${orgSlug}/event-baseline/`;
    const fetchID = Symbol('fetchID');

    this.setState({isLoading: true, fetchID});

    this.props.api
      .requestPromise(url, {
        method: 'GET',
        query: {
          ...eventView.getGlobalSelectionQuery(),
          query: eventView.query,
        },
      })
      .then(data => {
        if (this.state.fetchID !== fetchID) {
          // invariant: a different request was initiated after this request
          return;
        }

        this.setState({
          isLoading: false,
          fetchID: undefined,
          error: null,
          results: data,
        });
      })
      .catch(err => {
        this.setState({
          isLoading: false,
          fetchID: undefined,
          error: err?.responseJSON?.detail ?? null,
          results: null,
        });
      });
  };

  render() {
    const {isLoading, error, results} = this.state;

    const childrenProps = {
      isLoading,
      error,
      results,
    };

    return this.props.children(childrenProps);
  }
}

export default withApi(BaselineQuery);
