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
  isSearchDisabled: boolean;
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
  isSearchDisabled,
  sort,
  onSearch,
  location,
}: Props) {
  const pinnedSearch = savedSearch?.isPinned ? savedSearch : undefined;

  return (
    <SearchContainer>
      <PageFilterBar>
        <ProjectPageFilter />
        <EnvironmentPageFilter />
        <DatePageFilter alignDropdown="left" />
      </PageFilterBar>
      <IssueListSearchBar
        searchSource="main_search"
        organization={organization}
        query={query || ''}
        onSearch={onSearch}
        disabled={isSearchDisabled}
        excludedTags={['environment']}
        actionBarItems={[
          makePinSearchAction({sort, pinnedSearch, location}),
          makeSaveSearchAction({
            sort,
            disabled: !organization.access.includes('org:write'),
          }),
        ]}
      />
    </SearchContainer>
  );
}

const SearchContainer = styled('div')`
  display: grid;
  gap: ${space(2)};
  width: 100%;
  margin-bottom: ${space(2)};
  grid-template-columns: minmax(0, max-content) minmax(20rem, 1fr);

  @media (max-width: ${p => p.theme.breakpoints.small}) {
    grid-template-columns: minmax(0, 1fr);
  }
`;

export default withRouter(IssueListFilters);
