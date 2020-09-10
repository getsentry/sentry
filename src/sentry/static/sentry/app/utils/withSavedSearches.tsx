import React from 'react';
import Reflux from 'reflux';
import createReactClass from 'create-react-class';

import SavedSearchesStore from 'app/stores/savedSearchesStore';
import getDisplayName from 'app/utils/getDisplayName';
import {SavedSearch} from 'app/types';

type InjectedSavedSearchesProps = {
  savedSearches?: SavedSearch[];
  savedSearchLoading?: boolean;
  savedSearch?: SavedSearch | null;
};

type State = {
  savedSearches: SavedSearch[];
  isLoading: boolean;
};

/**
 * Currently wraps component with organization from context
 */
const withSavedSearches = <P extends InjectedSavedSearchesProps>(
  WrappedComponent: React.ComponentType<P>
) =>
  createReactClass<
    Omit<P, keyof InjectedSavedSearchesProps> & Partial<InjectedSavedSearchesProps>,
    State
  >({
    displayName: `withSavedSearches(${getDisplayName(WrappedComponent)})`,
    mixins: [Reflux.listenTo(SavedSearchesStore, 'onUpdate') as any],

    getInitialState() {
      return SavedSearchesStore.get();
    },

    onUpdate(newState) {
      this.setState(newState);
    },

    render() {
      const {params, location} = this.props;
      const {searchId} = params;
      const {savedSearches, isLoading} = this.state;
      let savedSearch = null;

      // Switch to the current saved search or pinned result if available
      if (!isLoading && savedSearches) {
        if (searchId) {
          const match = savedSearches.find(search => search.id === searchId);
          savedSearch = match ? match : null;
        }

        // If there's no direct saved search being requested (via URL route)
        // *AND* there's no query in URL, then check if there is pinned search
        //
        // Note: Don't use pinned searches when there is an empty query (query === empty string)
        if (!savedSearch && typeof location.query.query === 'undefined') {
          const pin = savedSearches.find(search => search.isPinned);
          savedSearch = pin ? pin : null;
        }
      }

      return (
        <WrappedComponent
          savedSearches={savedSearches as SavedSearch[]}
          savedSearchLoading={isLoading as boolean}
          savedSearch={savedSearch as SavedSearch | null}
          {...(this.props as P)}
        />
      );
    },
  });
export default withSavedSearches;
