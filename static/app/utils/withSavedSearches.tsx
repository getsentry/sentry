import {RouteComponentProps} from 'react-router';

import {SavedSearch} from 'sentry/types';
import useOrganization from 'sentry/utils/useOrganization';
import {useParams} from 'sentry/utils/useParams';
import {useFetchSavedSearchesForOrg} from 'sentry/views/issueList/queries/useFetchSavedSearchesForOrg';
import {useSelectedSavedSearch} from 'sentry/views/issueList/utils/useSelectedSavedSearch';

type InjectedSavedSearchesProps = {
  savedSearch: SavedSearch | null;
  savedSearchLoading: boolean;
  savedSearches: SavedSearch[];
  selectedSearchId: string | null;
} & RouteComponentProps<{searchId?: string}, {}>;

/**
 * HOC to provide saved search data to class components.
 * When possible, use the hooks directly instead.
 */
function withSavedSearches<P extends InjectedSavedSearchesProps>(
  WrappedComponent: React.ComponentType<P>
) {
  return function (
    props: Omit<P, keyof InjectedSavedSearchesProps> & Partial<InjectedSavedSearchesProps>
  ) {
    const organization = useOrganization();
    const {data: savedSearches, isLoading} = useFetchSavedSearchesForOrg({
      orgSlug: organization.slug,
    });
    const params = useParams();
    const selectedSavedSearch = useSelectedSavedSearch();

    return (
      <WrappedComponent
        {...(props as P)}
        savedSearches={props.savedSearches ?? savedSearches}
        savedSearchLoading={props.savedSearchLoading ?? isLoading}
        savedSearch={props.savedSearch ?? selectedSavedSearch}
        selectedSearchId={params.searchId ?? null}
      />
    );
  };
}

export default withSavedSearches;
