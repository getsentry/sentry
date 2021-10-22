import {GuideAnchor} from 'app/components/assistant/guideAnchor';
import SmartSearchBar from 'app/components/smartSearchBar';
import {t} from 'app/locale';
import {Tag} from 'app/types';
import {SEMVER_TAGS} from 'app/utils/discover/fields';

import {TagValueLoader} from '../issueList/types';

type Props = {
  query: string;
  onSearch: (q: string) => void;
  tagValueLoader: TagValueLoader;
};

function ProjectFilters({query, tagValueLoader, onSearch}: Props) {
  const getTagValues = async (tag: Tag, currentQuery: string): Promise<string[]> => {
    const values = await tagValueLoader(tag.key, currentQuery);
    return values.map(({value}) => value);
  };

  return (
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
  );
}

export default ProjectFilters;
