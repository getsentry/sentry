import type {RouteComponentProps} from 'react-router';

import type {SavedSearch} from 'sentry/types/group';
import useOrganization from 'sentry/utils/useOrganization';
import {useParams} from 'sentry/utils/useParams';
import {useFetchGroupSearchViews} from 'sentry/views/issueList/queries/useFetchGroupSearchViews';
import {useFetchSavedSearchesForOrg} from 'sentry/views/issueList/queries/useFetchSavedSearchesForOrg';
import type {GroupSearchView} from 'sentry/views/issueList/types';
import {useSelectedSavedSearch} from 'sentry/views/issueList/utils/useSelectedSavedSearch';

type InjectedSavedSearchesProps = {
  groupSearchView: GroupSearchView | null;
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
    const {data: savedSearches, isLoading} = useFetchSavedSearchesForOrg(
      {
        orgSlug: organization.slug,
      },
      {enabled: !organization.features.includes('issue-stream-custom-views')}
    );

    const {data: groupSearchViews} = useFetchGroupSearchViews(
      {
        orgSlug: organization.slug,
      },
      {enabled: organization.features.includes('issue-stream-custom-views')}
    );

    const params = useParams();
    const selectedSavedSearch = useSelectedSavedSearch();

    return (
      <WrappedComponent
        {...(props as P)}
        savedSearches={props.savedSearches ?? savedSearches}
        savedSearchLoading={props.savedSearchLoading ?? isLoading}
        savedSearch={props.savedSearch ?? selectedSavedSearch}
        selectedSearchId={params.searchId ?? null}
        groupSearchView={groupSearchViews?.[0] ?? null}
      />
    );
  };
}

export default withSavedSearches;
