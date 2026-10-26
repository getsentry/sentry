import {useCallback} from 'react';

import {Grid} from '@sentry/scraps/layout';

import {DatePageFilter} from 'sentry/components/pageFilters/date/datePageFilter';
import {EnvironmentPageFilter} from 'sentry/components/pageFilters/environment/environmentPageFilter';
import {PageFilterBar} from 'sentry/components/pageFilters/pageFilterBar';
import {SearchQueryBuilder} from 'sentry/components/searchQueryBuilder';
import type {GetTagValues} from 'sentry/components/searchQueryBuilder';
import {t} from 'sentry/locale';
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

export function ProjectFilters({
  query,
  relativeDateOptions,
  tagValueLoader,
  onSearch,
}: Props) {
  const getTagValues = useCallback<GetTagValues>(
    async ({tag, searchQuery}) => {
      const values = await tagValueLoader(tag.key, searchQuery);
      return values.map(({value}) => value);
    },
    [tagValueLoader]
  );

  return (
    <Grid columns={{zero: 'minmax(0, 1fr)', xl: 'minmax(0, max-content) 1fr'}} gap="xl">
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
    </Grid>
  );
}
