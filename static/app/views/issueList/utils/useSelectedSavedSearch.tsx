import {SavedSearch} from 'sentry/types';
import useOrganization from 'sentry/utils/useOrganization';
import {useParams} from 'sentry/utils/useParams';
import {useFetchSavedSearchesForOrg} from 'sentry/views/issueList/queries/useFetchSavedSearchesForOrg';

// Uses the saved search ID in the URL and the cached response to return
// the selected saved search object
export const useSelectedSavedSearch = (): SavedSearch | null => {
  const organization = useOrganization();
  const params = useParams();

  const {data: savedSearches} = useFetchSavedSearchesForOrg(
    {orgSlug: organization.slug},
    {notifyOnChangeProps: ['data']}
  );

  const selectedSearchId: string | undefined = params.searchId;

  return savedSearches?.find(({id}) => id === selectedSearchId) ?? null;
};
