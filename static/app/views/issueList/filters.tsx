import {useCallback, useState} from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';

import {LabelFilter} from 'sentry/components/issueLabels';
import {DatePageFilter} from 'sentry/components/organizations/datePageFilter';
import {EnvironmentPageFilter} from 'sentry/components/organizations/environmentPageFilter';
import PageFilterBar from 'sentry/components/organizations/pageFilterBar';
import {ProjectPageFilter} from 'sentry/components/organizations/projectPageFilter';
import {space} from 'sentry/styles/space';
import IssueListSortOptions from 'sentry/views/issueList/actions/sortOptions';
import {IssueSearchWithSavedSearches} from 'sentry/views/issueList/issueSearchWithSavedSearches';
import {IssueViewSaveButton} from 'sentry/views/issueList/issueViews/issueViewSaveButton';
import type {IssueSortOptions} from 'sentry/views/issueList/utils';
import {usePrefersStackedNav} from 'sentry/views/nav/usePrefersStackedNav';

interface Props {
  onSearch: (query: string) => void;
  onSortChange: (sort: string) => void;
  query: string;
  sort: IssueSortOptions;
  onLabelChange?: (labels: string[]) => void;
}

function IssueListFilters({query, sort, onSortChange, onSearch, onLabelChange}: Props) {
  const prefersStackedNav = usePrefersStackedNav();
  const [selectedLabels, setSelectedLabels] = useState<string[]>([]);

  const handleLabelChange = useCallback(
    (labels: string[]) => {
      setSelectedLabels(labels);
      // For now, just pass the labels up to the parent component
      // The actual filtering will be done client-side
      if (onLabelChange) {
        onLabelChange(labels);
      }
    },
    [onLabelChange]
  );

  return (
    <FiltersContainer prefersStackedNav={prefersStackedNav}>
      <StyledPageFilterBar>
        <ProjectPageFilter />
        <EnvironmentPageFilter />
        <DatePageFilter />
        <LabelFilter
          selectedLabels={selectedLabels}
          onLabelChange={handleLabelChange}
          size="sm"
        />
      </StyledPageFilterBar>

      <Search {...{query, onSearch}} />

      <SortSaveContainer>
        <IssueListSortOptions
          query={query}
          sort={sort}
          onSelect={onSortChange}
          triggerSize="md"
          showIcon={false}
        />

        {prefersStackedNav && <IssueViewSaveButton query={query} sort={sort} />}
      </SortSaveContainer>
    </FiltersContainer>
  );
}

const FiltersContainer = styled('div')<{prefersStackedNav: boolean}>`
  display: grid;
  column-gap: ${space(1)};
  row-gap: ${space(1)};
  margin-bottom: ${space(2)};
  width: 100%;

  ${p =>
    p.prefersStackedNav
      ? css`
          grid-template-columns: 100%;
          grid-template-areas:
            'page-filters'
            'search'
            'sort-save';

          @media (min-width: ${p.theme.breakpoints.xs}) {
            grid-template-columns: 1fr auto;
            grid-template-areas:
              'page-filters sort-save'
              'search search';
          }

          @media (min-width: ${p.theme.breakpoints.xl}) {
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

          @media (min-width: ${p.theme.breakpoints.xs}) {
            grid-template-columns: auto 1fr;
            grid-template-areas:
              'page-filters sort-save'
              'search search';
          }

          @media (min-width: ${p.theme.breakpoints.lg}) {
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
