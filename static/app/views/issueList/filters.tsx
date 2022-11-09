// eslint-disable-next-line no-restricted-imports
import {withRouter, WithRouterProps} from 'react-router';
import styled from '@emotion/styled';

import DatePageFilter from 'sentry/components/datePageFilter';
import EnvironmentPageFilter from 'sentry/components/environmentPageFilter';
import PageFilterBar from 'sentry/components/organizations/pageFilterBar';
import ProjectPageFilter from 'sentry/components/projectPageFilter';
import {
  makePinSearchAction,
  makeSaveSearchAction,
} from 'sentry/components/smartSearchBar/actions';
import space from 'sentry/styles/space';
import {Organization, SavedSearch} from 'sentry/types';

import IssueListSearchBar from './searchBar';

interface Props extends WithRouterProps {
  onSearch: (query: string) => void;
  organization: Organization;
  query: string;
  savedSearch: SavedSearch | null;
  sort: string;
}

function IssueListFilters({
  organization,
  savedSearch,
  query,
  sort,
  onSearch,
  location,
}: Props) {
  const pinnedSearch = savedSearch?.isPinned ? savedSearch : undefined;

  return (
    <SearchContainer>
      <StyledPageFilterBar>
        <ProjectPageFilter />
        <EnvironmentPageFilter />
        <DatePageFilter alignDropdown="left" />
      </StyledPageFilterBar>
      <StyledIssueListSearchBar
        searchSource="main_search"
        organization={organization}
        query={query || ''}
        onSearch={onSearch}
        excludedTags={['environment']}
        actionBarItems={
          organization.features.includes('issue-list-saved-searches-v2')
            ? []
            : [
                makePinSearchAction({sort, pinnedSearch, location}),
                makeSaveSearchAction({
                  sort,
                  disabled: !organization.access.includes('org:write'),
                }),
              ]
        }
      />
    </SearchContainer>
  );
}

const SearchContainer = styled('div')`
  display: flex;
  gap: ${space(2)};
  flex-wrap: wrap;
  width: 100%;
  margin-bottom: ${space(2)};
`;

const StyledPageFilterBar = styled(PageFilterBar)`
  flex: 1;
  width: 100%;
  max-width: 25rem;
`;

const StyledIssueListSearchBar = styled(IssueListSearchBar)`
  flex: 1;
  width: 100%;
  min-width: 20rem;

  @media (min-width: ${p => p.theme.breakpoints.small}) {
    min-width: 25rem;
  }
`;

export default withRouter(IssueListFilters);
