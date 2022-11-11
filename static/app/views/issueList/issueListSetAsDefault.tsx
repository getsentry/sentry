// eslint-disable-next-line no-restricted-imports
import {browserHistory, withRouter, WithRouterProps} from 'react-router';
import isNil from 'lodash/isNil';

import Button from 'sentry/components/button';
import {removeSpace} from 'sentry/components/smartSearchBar/utils';
import {IconBookmark} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {Organization, SavedSearch} from 'sentry/types';
import {SavedSearchType} from 'sentry/types/group';
import trackAdvancedAnalyticsEvent from 'sentry/utils/analytics/trackAdvancedAnalyticsEvent';
import {usePinSearch} from 'sentry/views/issueList/mutations/usePinSearch';
import {useUnpinSearch} from 'sentry/views/issueList/mutations/useUnpinSearch';

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
  const pinnedSearch = savedSearch?.isPinned ? savedSearch : undefined;
  const pinnedSearchActive = !isNil(pinnedSearch);

  const {mutate: pinSearch, isLoading: isPinning} = usePinSearch({
    onSuccess: response => {
      const {cursor: _cursor, page: _page, ...currentQuery} = location.query;
      browserHistory.push({
        ...location,
        pathname: `/organizations/${organization.slug}/issues/searches/${response.id}/`,
        query: {referrer: 'search-bar', ...currentQuery},
      });
    },
  });
  const {mutate: unpinSearch, isLoading: isUnpinning} = useUnpinSearch({
    onSuccess: () => {
      const {cursor: _cursor, page: _page, ...currentQuery} = location.query;
      browserHistory.push({
        ...location,
        pathname: `/organizations/${organization.slug}/issues/`,
        query: {
          referrer: 'search-bar',
          ...currentQuery,
        },
      });
    },
  });

  const onTogglePinnedSearch = () => {
    trackAdvancedAnalyticsEvent('search.pin', {
      organization,
      action: pinnedSearch ? 'unpin' : 'pin',
      search_type: 'issues',
      query: pinnedSearch?.query ?? query,
    });

    if (pinnedSearch) {
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

  if (!organization.features.includes('issue-list-saved-searches-v2')) {
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
};

export default withRouter(IssueListSetAsDefault);
