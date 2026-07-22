import styled from '@emotion/styled';

import {Flex, Grid} from '@sentry/scraps/layout';

import {DatePageFilter} from 'sentry/components/pageFilters/date/datePageFilter';
import {EnvironmentPageFilter} from 'sentry/components/pageFilters/environment/environmentPageFilter';
import {PageFilterBar} from 'sentry/components/pageFilters/pageFilterBar';
import {ProjectPageFilter} from 'sentry/components/pageFilters/project/projectPageFilter';
import {IssueListSortOptions} from 'sentry/views/issueList/actions/sortOptions';
import {IssueSearch} from 'sentry/views/issueList/issueSearch';
import {IssueViewSaveButton} from 'sentry/views/issueList/issueViews/issueViewSaveButton';
import type {IssueSortOptions} from 'sentry/views/issueList/utils';

interface Props {
  onSearch: (query: string) => void;
  onSortChange: (sort: string) => void;
  query: string;
  sort: IssueSortOptions;
}

const RESET_PARAMS_ON_CHANGE = ['page', 'cursor'];

export function IssueListFilters({query, sort, onSortChange, onSearch}: Props) {
  return (
    <Grid
      columns={{
        zero: '100%',
        xl: '1fr auto',
        '4xl': 'auto 1fr auto',
      }}
      areas={{
        zero: `
          "page-filters"
          "search"
          "sort-save"
        `,
        xl: `
          "page-filters sort-save"
          "search search"
        `,
        '4xl': '"page-filters search sort-save"',
      }}
      gap="md"
      marginBottom="xl"
      width="100%"
    >
      <StyledPageFilterBar>
        <ProjectPageFilter resetParamsOnChange={RESET_PARAMS_ON_CHANGE} />
        <EnvironmentPageFilter resetParamsOnChange={RESET_PARAMS_ON_CHANGE} />
        <DatePageFilter resetParamsOnChange={RESET_PARAMS_ON_CHANGE} />
      </StyledPageFilterBar>

      <Search {...{query, onSearch}} />

      <Flex justifySelf="end" gap="md" area="sort-save" align="start">
        <IssueListSortOptions
          query={query}
          sort={sort}
          onSelect={onSortChange}
          triggerSize="md"
          showIcon={false}
        />

        <IssueViewSaveButton query={query} sort={sort} />
      </Flex>
    </Grid>
  );
}

const Search = styled(IssueSearch)`
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
