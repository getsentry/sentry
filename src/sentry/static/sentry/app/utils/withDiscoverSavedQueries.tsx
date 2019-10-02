import React from 'react';
import Reflux from 'reflux';
import createReactClass from 'create-react-class';

import DiscoverSavedQueriesStore, {
  SavedQuery,
} from 'app/stores/discoverSavedQueriesStore';
import getDisplayName from 'app/utils/getDisplayName';

type InjectedDiscoverSavedQueriesProps = {
  savedQueries: SavedQuery[];
};

type State = {
  savedQueries: SavedQuery[];
};

/**
 * Higher order component that uses DiscoverSavedQueryStor and provides the
 * saved queries for the current organization
 */
const withDiscoverSavedQueries = <P extends InjectedDiscoverSavedQueriesProps>(
  WrappedComponent: React.ComponentType<P>
) =>
  createReactClass<
    Omit<P, keyof InjectedDiscoverSavedQueriesProps> &
      Partial<InjectedDiscoverSavedQueriesProps>,
    State
  >({
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
      const queries = DiscoverSavedQueriesStore.get().savedQueries.filter(
        (item: SavedQuery) => item.version === 2
      );
      this.setState({savedQueries: queries});
    },

    render() {
      return (
        <WrappedComponent savedQueries={this.state.savedQueries} {...this.props as P} />
      );
    },
  });

export default withDiscoverSavedQueries;
