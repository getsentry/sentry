import {css} from '@emotion/react';
import styled from '@emotion/styled';

import GuideAnchor from 'sentry/components/assistant/guideAnchor';
import {DatePageFilter} from 'sentry/components/organizations/datePageFilter';
import {EnvironmentPageFilter} from 'sentry/components/organizations/environmentPageFilter';
import PageFilterBar from 'sentry/components/organizations/pageFilterBar';
import {ProjectPageFilter} from 'sentry/components/organizations/projectPageFilter';
import {space} from 'sentry/styles/space';
import useOrganization from 'sentry/utils/useOrganization';
import IssueListSortOptions from 'sentry/views/issueList/actions/sortOptions';
import {IssueSearchWithSavedSearches} from 'sentry/views/issueList/issueSearchWithSavedSearches';

interface Props {
  onSearch: (query: string) => void;
  onSortChange: (sort: string) => void;
  query: string;
  sort: string;
}

function IssueListFilters({query, sort, onSortChange, onSearch}: Props) {
  const organization = useOrganization();

  const hasNewLayout = organization.features.includes('issue-stream-table-layout');
  const hasPageFiltersPersistence = organization.features.includes(
    'issue-views-page-filter'
  );

  return (
    <FiltersContainer hasNewLayout={hasNewLayout}>
      <GuideAnchor
        target="issue_views_page_filters_persistence"
        disabled={!hasPageFiltersPersistence}
      >
        <StyledPageFilterBar>
          <ProjectPageFilter />
          <EnvironmentPageFilter />
          <DatePageFilter />
        </StyledPageFilterBar>
      </GuideAnchor>

      <Search {...{query, onSearch}} />

      {organization.features.includes('issue-stream-table-layout') && (
        <Sort
          query={query}
          sort={sort}
          onSelect={onSortChange}
          triggerSize="md"
          showIcon={false}
        />
      )}
    </FiltersContainer>
  );
}

const FiltersContainer = styled('div')<{hasNewLayout: boolean}>`
  display: grid;
  column-gap: ${space(1)};
  row-gap: ${space(1)};
  margin-bottom: ${space(2)};
  width: 100%;

  ${p =>
    p.hasNewLayout
      ? css`
          grid-template-columns: 100%;
          grid-template-areas:
            'page-filters'
            'search'
            'sort';

          @media (min-width: ${p.theme.breakpoints.xsmall}) {
            grid-template-columns: auto 1fr;
            grid-template-areas:
              'page-filters sort'
              'search search';
          }

          @media (min-width: ${p.theme.breakpoints.large}) {
            grid-template-columns: auto 1fr auto;
            grid-template-areas: 'page-filters search sort';
          }
        `
      : css`
          grid-template-columns: 100%;
          grid-template-areas:
            'page-filters'
            'search';

          @media (min-width: ${p.theme.breakpoints.xsmall}) {
            grid-template-columns: auto 1fr;
            grid-template-areas:
              'page-filters sort'
              'search search';
          }

          @media (min-width: ${p.theme.breakpoints.large}) {
            grid-template-columns: auto 1fr;
            grid-template-areas: 'page-filters search';
          }
        `}
`;

const Search = styled(IssueSearchWithSavedSearches)`
  grid-area: search;
`;

const StyledPageFilterBar = styled(PageFilterBar)`
  grid-area: page-filters;
  display: flex;
  flex-basis: content;
  width: 100%;
  max-width: 43rem;
  justify-self: start;

  > div > button {
    width: 100%;
  }
`;

const Sort = styled(IssueListSortOptions)`
  grid-area: sort;
  justify-self: end;
`;

export default IssueListFilters;
