import {css} from '@emotion/react';
import styled from '@emotion/styled';

import {Button, ButtonLabel} from 'sentry/components/button';
import {t} from 'sentry/locale';
import {trackAnalytics} from 'sentry/utils/analytics';
import useOrganization from 'sentry/utils/useOrganization';
import {useSyncedLocalStorageState} from 'sentry/utils/useSyncedLocalStorageState';
import {SAVED_SEARCHES_SIDEBAR_OPEN_LOCALSTORAGE_KEY} from 'sentry/views/issueList/utils';
import {useSelectedSavedSearch} from 'sentry/views/issueList/utils/useSelectedSavedSearch';

import IssueListSearchBar from './searchBar';

type IssueSearchWithSavedSearchesProps = {
  onSearch: (query: string) => void;
  query: string;
  className?: string;
};

export function IssueSearchWithSavedSearches({
  className,
  query,
  onSearch,
}: IssueSearchWithSavedSearchesProps) {
  const organization = useOrganization();
  const selectedSavedSearch = useSelectedSavedSearch();
  const [isSavedSearchesOpen, setIsSavedSearchesOpen] = useSyncedLocalStorageState(
    SAVED_SEARCHES_SIDEBAR_OPEN_LOCALSTORAGE_KEY,
    false
  );

  function onSavedSearchesToggleClicked() {
    const newOpenState = !isSavedSearchesOpen;
    trackAnalytics('search.saved_search_sidebar_toggle_clicked', {
      organization,
      open: newOpenState,
    });
    setIsSavedSearchesOpen(newOpenState);
  }

  return (
    <SearchBarWithButtonContainer className={className}>
      {!organization.features.includes('issue-stream-custom-views') && (
        <StyledButton onClick={onSavedSearchesToggleClicked}>
          {selectedSavedSearch?.name ?? t('Custom Search')}
        </StyledButton>
      )}
      <StyledIssueListSearchBarWithButton
        searchSource="main_search"
        organization={organization}
        initialQuery={query || ''}
        onSearch={onSearch}
        placeholder={t('Search for events, users, tags, and more')}
        roundCorners={organization.features.includes('issue-stream-custom-views')}
      />
    </SearchBarWithButtonContainer>
  );
}

const SearchBarWithButtonContainer = styled('div')`
  flex: 1;
  display: flex;
  align-items: stretch;
  width: 100%;

  @media (min-width: ${p => p.theme.breakpoints.small}) {
    flex-basis: 35rem;
  }
`;

const StyledButton = styled(Button)`
  /* Hide this button on small screens */
  display: none;

  @media (min-width: ${p => p.theme.breakpoints.small}) {
    display: flex;
    align-items: center;
    height: 100%;
    max-width: 180px;
    text-align: left;
    border-top-right-radius: 0;
    border-bottom-right-radius: 0;
    border-right: none;

    ${ButtonLabel} {
      height: auto;
      display: block;
      ${p => p.theme.overflowEllipsis};
    }
  }
`;

const StyledIssueListSearchBarWithButton = styled(IssueListSearchBar)<{
  roundCorners: boolean;
}>`
  flex: 1;
  min-width: 0;

  ${p =>
    !p.roundCorners &&
    css`
      @media (min-width: ${p.theme.breakpoints.small}) {
        border-top-left-radius: 0;
        border-bottom-left-radius: 0;
      }
    `}
`;
