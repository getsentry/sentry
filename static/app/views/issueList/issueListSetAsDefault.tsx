// eslint-disable-next-line no-restricted-imports
import {browserHistory, withRouter, WithRouterProps} from 'react-router';
import isNil from 'lodash/isNil';

import {pinSearch, unpinSearch} from 'sentry/actionCreators/savedSearches';
import Button from 'sentry/components/button';
import {removeSpace} from 'sentry/components/smartSearchBar/utils';
import {IconBookmark} from 'sentry/icons';
import {t} from 'sentry/locale';
import {Organization, SavedSearch, SavedSearchType} from 'sentry/types';
import trackAdvancedAnalyticsEvent from 'sentry/utils/analytics/trackAdvancedAnalyticsEvent';
import useApi from 'sentry/utils/useApi';

interface IssueListSetAsDefaultProps extends WithRouterProps {
  organization: Organization;
  query: string;
  savedSearch: SavedSearch | null;
  sort: string;
}

const IssueListSetAsDefault = ({
  location,
  organization,
  savedSearch,
  sort,
  query,
}: IssueListSetAsDefaultProps) => {
  const api = useApi();
  const pinnedSearch = savedSearch?.isPinned ? savedSearch : undefined;
  const pinnedSearchActive = !isNil(pinnedSearch);

  const onTogglePinnedSearch = async () => {
    const {cursor: _cursor, page: _page, ...currentQuery} = location.query;

    trackAdvancedAnalyticsEvent('search.pin', {
      organization,
      action: pinnedSearch ? 'unpin' : 'pin',
      search_type: 'issues',
      query: pinnedSearch?.query ?? query,
    });

    if (pinnedSearch) {
      await unpinSearch(api, organization.slug, SavedSearchType.ISSUE, pinnedSearch);
      browserHistory.push({
        ...location,
        pathname: `/organizations/${organization.slug}/issues/`,
        query: {
          referrer: 'search-bar',
          ...currentQuery,
          query: pinnedSearch.query,
          sort: pinnedSearch.sort,
        },
      });
      return;
    }

    const resp = await pinSearch(
      api,
      organization.slug,
      SavedSearchType.ISSUE,
      removeSpace(query),
      sort
    );

    if (!resp || !resp.id) {
      return;
    }

    browserHistory.push({
      ...location,
      pathname: `/organizations/${organization.slug}/issues/searches/${resp.id}/`,
      query: {referrer: 'search-bar', ...currentQuery},
    });
  };

  if (!organization.features.includes('issue-list-saved-searches-v2')) {
    return null;
  }

  return (
    <Button
      onClick={onTogglePinnedSearch}
      size="sm"
      icon={<IconBookmark isSolid={pinnedSearchActive} />}
    >
      {pinnedSearchActive ? t('Remove Default') : t('Set as Default')}
    </Button>
  );
};

export default withRouter(IssueListSetAsDefault);
