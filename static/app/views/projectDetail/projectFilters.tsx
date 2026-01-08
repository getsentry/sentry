import {useCallback} from 'react';
import styled from '@emotion/styled';

import {DatePageFilter} from 'sentry/components/organizations/datePageFilter';
import {EnvironmentPageFilter} from 'sentry/components/organizations/environmentPageFilter';
import PageFilterBar from 'sentry/components/organizations/pageFilterBar';
import {SearchQueryBuilder} from 'sentry/components/searchQueryBuilder';
import type {GetTagValues} from 'sentry/components/searchQueryBuilder';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {SEMVER_TAGS} from 'sentry/utils/discover/fields';
import type {TagValueLoader} from 'sentry/views/issueList/types';

type Props = {
  onSearch: (q: string) => void;
  query: string;
  relativeDateOptions: React.ComponentProps<typeof DatePageFilter>['relativeOptions'];
  tagValueLoader: TagValueLoader;
};

const SUPPORTED_TAGS = {
  ...SEMVER_TAGS,
  release: {
    key: 'release',
    name: 'release',
  },
};

function ProjectFilters({query, relativeDateOptions, tagValueLoader, onSearch}: Props) {
  const getTagValues = useCallback<GetTagValues>(
    async (tag, currentQuery) => {
      const values = await tagValueLoader(tag.key, currentQuery);
      return values.map(({value}) => value);
    },
    [tagValueLoader]
  );

  return (
    <FiltersWrapper>
      <PageFilterBar>
        <EnvironmentPageFilter />
        <DatePageFilter relativeOptions={relativeDateOptions} />
      </PageFilterBar>
      <SearchQueryBuilder
        searchSource="project_filters"
        initialQuery={query ?? ''}
        placeholder={t('Search by release version, build, package, or stage')}
        filterKeys={SUPPORTED_TAGS}
        onSearch={onSearch}
        getTagValues={getTagValues}
      />
    </FiltersWrapper>
  );
}

const FiltersWrapper = styled('div')`
  display: grid;
  grid-template-columns: minmax(0, max-content) 1fr;
  gap: ${space(2)};

  @media (max-width: ${p => p.theme.breakpoints.sm}) {
    grid-template-columns: minmax(0, 1fr);
  }
`;

export default ProjectFilters;
