import isNil from 'lodash/isNil';

import {SavedSearch} from 'sentry/types';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import {useParams} from 'sentry/utils/useParams';
import {useFetchSavedSearchesForOrg} from 'sentry/views/issueList/queries/useFetchSavedSearchesForOrg';

// Uses the saved search ID in the URL and the cached response to return
// the selected saved search object
export const useSelectedSavedSearch = (): SavedSearch | null => {
  const organization = useOrganization();
  const location = useLocation();
  const params = useParams();

  const {data: savedSearches} = useFetchSavedSearchesForOrg(
    {orgSlug: organization.slug},
    {notifyOnChangeProps: ['data']}
  );

  const selectedSearchId: string | undefined = params.searchId;

  // If there's no direct saved search being requested (via URL route)
  // *AND* there's no query in URL, then check if there is pinned search
  //
  // Note: Don't use pinned searches when there is an empty query (query === empty string)
  if (!selectedSearchId && isNil(location.query.query)) {
    return savedSearches?.find(search => search.isPinned) ?? null;
  }

  return savedSearches?.find(({id}) => id === selectedSearchId) ?? null;
};
