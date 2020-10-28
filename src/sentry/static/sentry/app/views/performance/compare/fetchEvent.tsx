import React from 'react';

import {Client} from 'app/api';
import withApi from 'app/utils/withApi';
import {Event} from 'app/types';

export type ChildrenProps = {
  isLoading: boolean;
  error: null | string;
  event: Event | undefined;
};

type Props = {
  api: Client;

  orgSlug: string;
  eventSlug: string;

  children: (props: ChildrenProps) => React.ReactNode;
};

type State = {
  tableFetchID: symbol | undefined;
} & ChildrenProps;

class FetchEvent extends React.Component<Props, State> {
  state: State = {
    isLoading: true,
    tableFetchID: undefined,
    error: null,

    event: undefined,
  };

  componentDidMount() {
    this.fetchData();
  }

  componentDidUpdate(prevProps: Props) {
    const orgSlugChanged = prevProps.orgSlug !== this.props.orgSlug;
    const eventSlugChanged = prevProps.eventSlug !== this.props.eventSlug;

    if (!this.state.isLoading && (orgSlugChanged || eventSlugChanged)) {
      this.fetchData();
    }
  }

  fetchData() {
    const {orgSlug, eventSlug} = this.props;

    // note: eventSlug is of the form <project-slug>:<event-id>

    const url = `/organizations/${orgSlug}/events/${eventSlug}/`;
    const tableFetchID = Symbol('tableFetchID');

    this.setState({isLoading: true, tableFetchID});

    this.props.api
      .requestPromise(url, {
        method: 'GET',
      })
      .then(data => {
        if (this.state.tableFetchID !== tableFetchID) {
          // invariant: a different request was initiated after this request
          return;
        }

        this.setState({
          isLoading: false,
          tableFetchID: undefined,
          error: null,
          event: data,
        });
      })
      .catch(err => {
        this.setState({
          isLoading: false,
          tableFetchID: undefined,
          error: err?.responseJSON?.detail ?? null,
          event: undefined,
        });
      });
  }

  render() {
    const {isLoading, error, event} = this.state;

    const childrenProps: ChildrenProps = {
      isLoading,
      error,
      event,
    };

    return this.props.children(childrenProps);
  }
}

export default withApi(FetchEvent);
