import {Button} from 'sentry/components/button';
import {removeSpace} from 'sentry/components/deprecatedSmartSearchBar/utils';
import {IconBookmark} from 'sentry/icons';
import {t} from 'sentry/locale';
import {SavedSearchType} from 'sentry/types/group';
import type {Organization} from 'sentry/types/organization';
import {trackAnalytics} from 'sentry/utils/analytics';
import {browserHistory} from 'sentry/utils/browserHistory';
import normalizeUrl from 'sentry/utils/url/normalizeUrl';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import {usePinSearch} from 'sentry/views/issueList/mutations/usePinSearch';
import {useUnpinSearch} from 'sentry/views/issueList/mutations/useUnpinSearch';
import {useFetchSavedSearchesForOrg} from 'sentry/views/issueList/queries/useFetchSavedSearchesForOrg';
import {isDefaultIssueStreamSearch} from 'sentry/views/issueList/utils';
import {useSelectedSavedSearch} from 'sentry/views/issueList/utils/useSelectedSavedSearch';

interface IssueListSetAsDefaultProps {
  organization: Organization;
  query: string;
  sort: string;
}

const usePinnedSearch = () => {
  const organization = useOrganization();
  const {data: savedSearches} = useFetchSavedSearchesForOrg(
    {orgSlug: organization.slug},
    {notifyOnChangeProps: ['data']}
  );

  return savedSearches?.find(savedSearch => savedSearch.isPinned) ?? null;
};

function IssueListSetAsDefault({organization, sort, query}: IssueListSetAsDefaultProps) {
  const location = useLocation();

  const selectedSavedSearch = useSelectedSavedSearch();
  const pinnedSearch = usePinnedSearch();
  const pinnedSearchActive = selectedSavedSearch
    ? pinnedSearch?.id === selectedSavedSearch?.id
    : false;

  const {mutate: pinSearch, isPending: isPinning} = usePinSearch({
    onSuccess: response => {
      const {cursor: _cursor, page: _page, ...currentQuery} = location.query;
      browserHistory.replace(
        normalizeUrl({
          ...location,
          pathname: `/organizations/${organization.slug}/issues/searches/${response.id}/`,
          query: {referrer: 'search-bar', ...currentQuery},
        })
      );
    },
  });
  const {mutate: unpinSearch, isPending: isUnpinning} = useUnpinSearch({
    onSuccess: () => {
      const {cursor: _cursor, page: _page, ...currentQuery} = location.query;
      browserHistory.replace(
        normalizeUrl({
          ...location,
          pathname: `/organizations/${organization.slug}/issues/`,
          query: {
            referrer: 'search-bar',
            query,
            sort,
            ...currentQuery,
          },
        })
      );
    },
  });

  const onTogglePinnedSearch = () => {
    trackAnalytics('search.pin', {
      organization,
      action: pinnedSearch ? 'unpin' : 'pin',
      search_type: 'issues',
      query: pinnedSearch?.query ?? query,
      sort,
    });

    if (pinnedSearchActive) {
      unpinSearch({orgSlug: organization.slug, type: SavedSearchType.ISSUE});
    } else {
      pinSearch({
        orgSlug: organization.slug,
        type: SavedSearchType.ISSUE,
        query: removeSpace(query),
        sort,
      });
    }
  };

  // Hide if we are already on the default search,
  // except when the user has a different search pinned.
  if (
    isDefaultIssueStreamSearch({query, sort}) &&
    (!pinnedSearch || isDefaultIssueStreamSearch(pinnedSearch))
  ) {
    return null;
  }

  return (
    <Button
      onClick={onTogglePinnedSearch}
      size="sm"
      icon={<IconBookmark isSolid={pinnedSearchActive} />}
      disabled={isPinning || isUnpinning}
    >
      {pinnedSearchActive ? t('Remove Default') : t('Set as Default')}
    </Button>
  );
}

export default IssueListSetAsDefault;
