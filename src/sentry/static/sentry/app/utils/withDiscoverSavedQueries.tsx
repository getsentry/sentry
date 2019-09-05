import React from 'react';
import Reflux from 'reflux';
import createReactClass from 'create-react-class';

import DiscoverSavedQueriesStore from 'app/stores/discoverSavedQueriesStore';
import getDisplayName from 'app/utils/getDisplayName';
import {SavedQuery} from 'app/views/discover/types';

/**
 * Higher order component that uses DiscoverSavedQueryStor and provides the
 * saved queries for the current organization
 */
const withDiscoverSavedQueries = <P extends object>(
  WrappedComponent: React.ComponentType<P>
) =>
  createReactClass({
    displayName: `withDiscoverSavedQuery(${getDisplayName(WrappedComponent)})`,
    mixins: [Reflux.listenTo(DiscoverSavedQueriesStore, 'onUpdate')],

    getInitialState() {
      return {
        savedQueries: DiscoverSavedQueriesStore.get().savedQueries,
      };
    },

    componentDidMount() {
      this.updateQueries();
    },

    onUpdate() {
      this.updateQueries();
    },

    updateQueries() {
      const state = DiscoverSavedQueriesStore.get();

      if (this.state.savedQueries !== state.savedQueries) {
        this.setState({savedQueries: state.savedQueries});
      }
    },

    render() {
      return (
        <WrappedComponent
          savedQueries={this.state.savedQueries as SavedQuery[]}
          {...this.props as P}
        />
      );
    },
  });

export default withDiscoverSavedQueries;
