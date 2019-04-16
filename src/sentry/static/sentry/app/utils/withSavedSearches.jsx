import React from 'react';
import Reflux from 'reflux';
import createReactClass from 'create-react-class';

import Feature from 'app/components/acl/feature';
import SavedSearchesStore from 'app/stores/savedSearchesStore';
import getDisplayName from 'app/utils/getDisplayName';

/**
 * Currently wraps component with organization from context
 */
const withSavedSearches = WrappedComponent =>
  createReactClass({
    displayName: `withSavedSearches(${getDisplayName(WrappedComponent)})`,
    mixins: [Reflux.listenTo(SavedSearchesStore, 'onUpdate')],
    getInitialState() {
      return SavedSearchesStore.get();
    },

    onUpdate(newState) {
      this.setState(newState);
    },

    render() {
      return (
        <Feature features={['org-saved-searches']}>
          {({hasFeature}) => {
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
              if (hasFeature && !savedSearch && !location.query.query) {
                const pin = savedSearches.find(search => search.isPinned);
                savedSearch = pin ? pin : null;
              }
            }

            return (
              <WrappedComponent
                savedSearches={savedSearches}
                savedSearchLoading={isLoading}
                savedSearch={savedSearch}
                useOrgSavedSearches={hasFeature}
                {...this.props}
              />
            );
          }}
        </Feature>
      );
    },
  });

export default withSavedSearches;
