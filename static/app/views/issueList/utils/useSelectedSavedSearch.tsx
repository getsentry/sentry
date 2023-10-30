import {useMemo} from 'react';
import isNil from 'lodash/isNil';

import {t} from 'sentry/locale';
import {SavedSearch} from 'sentry/types';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import {useParams} from 'sentry/utils/useParams';
import {useFetchSavedSearchesForOrg} from 'sentry/views/issueList/queries/useFetchSavedSearchesForOrg';

const PINNED_SEARCH_NAME = t('My Default Search');

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
  const selectedSavedSearch =
    !selectedSearchId && isNil(location.query.query)
      ? savedSearches?.find(search => search.isPinned)
      : savedSearches?.find(({id}) => id === selectedSearchId);

  return useMemo(
    () =>
      selectedSavedSearch?.isPinned
        ? {
            ...selectedSavedSearch,
            name: PINNED_SEARCH_NAME,
          }
        : selectedSavedSearch ?? null,
    [selectedSavedSearch]
  );
};
