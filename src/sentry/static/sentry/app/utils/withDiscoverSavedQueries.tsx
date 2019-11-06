import React from 'react';
import Reflux from 'reflux';
import createReactClass from 'create-react-class';

import DiscoverSavedQueriesStore, {
  SavedQuery,
} from 'app/stores/discoverSavedQueriesStore';
import getDisplayName from 'app/utils/getDisplayName';

type InjectedDiscoverSavedQueriesProps = {
  savedQueries: SavedQuery[];
  savedQueriesLoading: boolean;
};

type State = {
  savedQueries: SavedQuery[];
  savedQueriesLoading: boolean;
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
    mixins: [Reflux.listenTo(DiscoverSavedQueriesStore, 'onUpdate') as any],

    getInitialState() {
      const {savedQueries, isLoading} = DiscoverSavedQueriesStore.get();

      return {
        savedQueries,
        savedQueriesLoading: isLoading,
      };
    },

    componentDidMount() {
      this.updateQueries();
    },

    onUpdate() {
      this.updateQueries();
    },

    updateQueries() {
      const {savedQueries, isLoading} = DiscoverSavedQueriesStore.get();

      const queries = savedQueries.filter((item: SavedQuery) => item.version === 2);
      this.setState({savedQueries: queries, savedQueriesLoading: isLoading});
    },

    render() {
      return (
        <WrappedComponent
          savedQueries={this.state.savedQueries}
          savedQueriesLoading={this.state.savedQueriesLoading}
          {...this.props as P}
        />
      );
    },
  });

export default withDiscoverSavedQueries;
