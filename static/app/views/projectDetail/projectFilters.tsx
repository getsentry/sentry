import styled from '@emotion/styled';

import GuideAnchor from 'sentry/components/assistant/guideAnchor';
import {DatePageFilter} from 'sentry/components/organizations/datePageFilter';
import {EnvironmentPageFilter} from 'sentry/components/organizations/environmentPageFilter';
import PageFilterBar from 'sentry/components/organizations/pageFilterBar';
import SmartSearchBar from 'sentry/components/smartSearchBar';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {Tag} from 'sentry/types';
import {SEMVER_TAGS} from 'sentry/utils/discover/fields';

import {TagValueLoader} from '../issueList/types';

type Props = {
  onSearch: (q: string) => void;
  query: string;
  relativeDateOptions: React.ComponentProps<typeof DatePageFilter>['relativeOptions'];
  tagValueLoader: TagValueLoader;
};

function ProjectFilters({query, relativeDateOptions, tagValueLoader, onSearch}: Props) {
  const getTagValues = async (tag: Tag, currentQuery: string): Promise<string[]> => {
    const values = await tagValueLoader(tag.key, currentQuery);
    return values.map(({value}) => value);
  };

  return (
    <FiltersWrapper>
      <PageFilterBar>
        <EnvironmentPageFilter />
        <DatePageFilter relativeOptions={relativeDateOptions} />
      </PageFilterBar>
      <GuideAnchor target="releases_search" position="bottom">
        <SmartSearchBar
          searchSource="project_filters"
          query={query}
          placeholder={t('Search by release version, build, package, or stage')}
          hasRecentSearches={false}
          supportedTags={{
            ...SEMVER_TAGS,
            release: {
              key: 'release',
              name: 'release',
            },
          }}
          maxMenuHeight={500}
          onSearch={onSearch}
          onGetTagValues={getTagValues}
        />
      </GuideAnchor>
    </FiltersWrapper>
  );
}

const FiltersWrapper = styled('div')`
  display: grid;
  grid-template-columns: minmax(0, max-content) 1fr;
  gap: ${space(2)};

  @media (max-width: ${p => p.theme.breakpoints.small}) {
    grid-template-columns: minmax(0, 1fr);
  }
`;

export default ProjectFilters;
