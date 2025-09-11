import styled from '@emotion/styled';

import {t} from 'sentry/locale';
import useOrganization from 'sentry/utils/useOrganization';

import IssueListSearchBar from './searchBar';

type IssueSearchWithSavedSearchesProps = {
  onSearch: (query: string) => void;
  query: string;
  className?: string;
};

export function IssueSearch({
  className,
  query,
  onSearch,
}: IssueSearchWithSavedSearchesProps) {
  const organization = useOrganization();

  return (
    <SearchBarWithButtonContainer className={className}>
      <StyledIssueListSearchBarWithButton
        searchSource="main_search"
        organization={organization}
        initialQuery={query || ''}
        onSearch={onSearch}
        placeholder={t('Search for events, users, tags, and more')}
      />
    </SearchBarWithButtonContainer>
  );
}

const SearchBarWithButtonContainer = styled('div')`
  flex: 1;
  display: flex;
  align-items: stretch;
  width: 100%;

  @media (min-width: ${p => p.theme.breakpoints.sm}) {
    flex-basis: 35rem;
  }
`;

const StyledIssueListSearchBarWithButton = styled(IssueListSearchBar)`
  flex: 1;
  min-width: 0;
`;
