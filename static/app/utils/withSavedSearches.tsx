import {Component, useMemo} from 'react';
import {RouteComponentProps} from 'react-router';

import SavedSearchesStore from 'sentry/stores/savedSearchesStore';
import type {SavedSearch} from 'sentry/types';
import getDisplayName from 'sentry/utils/getDisplayName';
import useOrganization from 'sentry/utils/useOrganization';
import {useFetchSavedSearchesForOrg} from 'sentry/views/issueList/queries/useFetchSavedSearchesForOrg';
import {useSelectedSavedSearch} from 'sentry/views/issueList/utils/useSelectedSavedSearch';

type InjectedSavedSearchesProps = {
  savedSearch: SavedSearch | null;
  savedSearchLoading: boolean;
  savedSearches: SavedSearch[];
} & RouteComponentProps<{searchId?: string}, {}>;

type State = {
  isLoading: boolean;
  savedSearches: SavedSearch[];
};

/**
 * HOC to provide saved search data to class components.
 * When possible, use the hooks directly instead.
 */
function withSavedSearchesV2<P extends InjectedSavedSearchesProps>(
  WrappedComponent: React.ComponentType<P>
) {
  return (
    props: Omit<P, keyof InjectedSavedSearchesProps> & Partial<InjectedSavedSearchesProps>
  ) => {
    const organization = useOrganization();
    const {data: savedSearches, isLoading} = useFetchSavedSearchesForOrg({
      orgSlug: organization.slug,
    });
    const selectedSavedSearch = useSelectedSavedSearch();

    return (
      <WrappedComponent
        {...(props as P)}
        savedSearches={props.savedSearches ?? savedSearches}
        savedSearchLoading={props.savedSearchLoading ?? isLoading}
        savedSearch={props.savedSearch ?? selectedSavedSearch}
      />
    );
  };
}

/**
 * Wrap a component with saved issue search data from the store.
 */
function withSavedSearchesV1<P extends InjectedSavedSearchesProps>(
  WrappedComponent: React.ComponentType<P>
) {
  class WithSavedSearches extends Component<
    Omit<P, keyof InjectedSavedSearchesProps> & Partial<InjectedSavedSearchesProps>,
    State
  > {
    static displayName = `withSavedSearches(${getDisplayName(WrappedComponent)})`;

    state = SavedSearchesStore.get();

    componentWillUnmount() {
      this.unsubscribe();
    }

    unsubscribe = SavedSearchesStore.listen(
      (searchesState: State) => this.onUpdate(searchesState),
      undefined
    );

    onUpdate(newState: State) {
      this.setState(newState);
    }

    render() {
      const {
        params,
        location,
        savedSearchLoading,
        savedSearch: savedSearchProp,
        savedSearches: savedSearchesProp,
      } = this.props as P;
      const {searchId} = params;
      const {savedSearches, isLoading} = this.state as State;
      let savedSearch: SavedSearch | null = null;

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
          {...(this.props as P)}
          savedSearches={savedSearchesProp ?? savedSearches}
          savedSearchLoading={savedSearchLoading ?? isLoading}
          savedSearch={savedSearchProp ?? savedSearch}
        />
      );
    }
  }

  return WithSavedSearches;
}

/**
 * Temporary wrapper that provides saved searches data from the store or react-query,
 * depending on the issue-list-saved-searches-v2 feature flag.
 */
function withSavedSearches<P extends InjectedSavedSearchesProps>(
  WrappedComponent: React.ComponentType<P>
) {
  return (
    props: Omit<P, keyof InjectedSavedSearchesProps> & Partial<InjectedSavedSearchesProps>
  ) => {
    const organization = useOrganization();

    const WithSavedSearchesComponent = useMemo(() => {
      return organization.features.includes('issue-list-saved-searches-v2')
        ? withSavedSearchesV2(WrappedComponent)
        : withSavedSearchesV1(WrappedComponent);
    }, [organization]);

    return <WithSavedSearchesComponent {...props} />;
  };
}

export default withSavedSearches;
