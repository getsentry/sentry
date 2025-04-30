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
import {IssueViewSaveButton} from 'sentry/views/issueList/issueViews/issueViewSaveButton';
import type {IssueSortOptions} from 'sentry/views/issueList/utils';

interface Props {
  onSearch: (query: string) => void;
  onSortChange: (sort: string) => void;
  query: string;
  sort: IssueSortOptions;
}

function IssueListFilters({query, sort, onSortChange, onSearch}: Props) {
  const organization = useOrganization();

  const hasIssueViews = organization.features.includes('issue-stream-custom-views');
  const hasIssueViewSharing = organization.features.includes('issue-view-sharing');

  return (
    <FiltersContainer hasIssueViewSharing={hasIssueViewSharing}>
      <GuideAnchor
        target="issue_views_page_filters_persistence"
        disabled={!hasIssueViews}
      >
        <StyledPageFilterBar>
          <ProjectPageFilter />
          <EnvironmentPageFilter />
          <DatePageFilter />
        </StyledPageFilterBar>
      </GuideAnchor>

      <Search {...{query, onSearch}} />

      <SortSaveContainer>
        <IssueListSortOptions
          query={query}
          sort={sort}
          onSelect={onSortChange}
          triggerSize="md"
          showIcon={false}
        />

        {hasIssueViewSharing && <IssueViewSaveButton query={query} sort={sort} />}
      </SortSaveContainer>
    </FiltersContainer>
  );
}

const FiltersContainer = styled('div')<{hasIssueViewSharing: boolean}>`
  display: grid;
  column-gap: ${space(1)};
  row-gap: ${space(1)};
  margin-bottom: ${space(2)};
  width: 100%;

  ${p =>
    p.hasIssueViewSharing
      ? css`
          grid-template-columns: 100%;
          grid-template-areas:
            'page-filters'
            'search'
            'sort-save';

          @media (min-width: ${p.theme.breakpoints.xsmall}) {
            grid-template-columns: 1fr auto;
            grid-template-areas:
              'page-filters sort-save'
              'search search';
          }

          @media (min-width: ${p.theme.breakpoints.xlarge}) {
            grid-template-columns: auto 1fr auto;
            grid-template-areas: 'page-filters search sort-save';
          }
        `
      : css`
          grid-template-columns: 100%;
          grid-template-areas:
            'page-filters'
            'search'
            'sort-save';

          @media (min-width: ${p.theme.breakpoints.xsmall}) {
            grid-template-columns: auto 1fr;
            grid-template-areas:
              'page-filters sort-save'
              'search search';
          }

          @media (min-width: ${p.theme.breakpoints.large}) {
            grid-template-columns: auto 1fr auto;
            grid-template-areas: 'page-filters search sort-save';
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
  max-width: 100%;
  justify-self: start;

  > div > button {
    width: 100%;
  }
`;

const SortSaveContainer = styled('div')`
  display: flex;
  align-items: start;
  gap: ${space(1)};
  grid-area: sort-save;

  justify-self: end;
`;

export default IssueListFilters;
