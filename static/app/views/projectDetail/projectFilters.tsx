import styled from '@emotion/styled';

import {GuideAnchor} from 'sentry/components/assistant/guideAnchor';
import DatePageFilter from 'sentry/components/datePageFilter';
import EnvironmentPageFilter from 'sentry/components/environmentPageFilter';
import PageFilterBar from 'sentry/components/organizations/pageFilterBar';
import SmartSearchBar from 'sentry/components/smartSearchBar';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {Tag} from 'sentry/types';
import {SEMVER_TAGS} from 'sentry/utils/discover/fields';

import {TagValueLoader} from '../issueList/types';

type Props = {
  onSearch: (q: string) => void;
  query: string;
  tagValueLoader: TagValueLoader;
  hasPageFilters?: boolean;
};

function ProjectFilters({query, tagValueLoader, onSearch, hasPageFilters}: Props) {
  const getTagValues = async (tag: Tag, currentQuery: string): Promise<string[]> => {
    const values = await tagValueLoader(tag.key, currentQuery);
    return values.map(({value}) => value);
  };

  return (
    <FiltersWrapper>
      {hasPageFilters && (
        <StyledPageFilterBar>
          <EnvironmentPageFilter />
          <DatePageFilter alignDropdown="left" />
        </StyledPageFilterBar>
      )}
      <SearchBarWrapper>
        <GuideAnchor target="releases_search" position="bottom">
          <SmartSearchBar
            searchSource="project_filters"
            query={query}
            placeholder={t('Search by release version, build, package, or stage')}
            maxSearchItems={5}
            hasRecentSearches={false}
            supportedTags={{
              ...SEMVER_TAGS,
              release: {
                key: 'release',
                name: 'release',
              },
            }}
            onSearch={onSearch}
            onGetTagValues={getTagValues}
          />
        </GuideAnchor>
      </SearchBarWrapper>
    </FiltersWrapper>
  );
}

const StyledPageFilterBar = styled(PageFilterBar)`
  margin-bottom: ${space(1)};
  margin-right: ${space(1)};
`;

const FiltersWrapper = styled('div')`
  display: flex;
  flex-wrap: wrap;
`;

const SearchBarWrapper = styled('div')`
  flex: 1;
  flex-basis: 430px;
`;

export default ProjectFilters;
