import SmartSearchBar from 'app/components/smartSearchBar';
import {t} from 'app/locale';
import {Tag} from 'app/types';
import {ADOPTION_STAGE_LABELS} from 'app/views/releases/list/releaseHealth/content';

import {TagValueLoader} from '../issueList/types';

const supportedTags = {
  'release.version': {
    key: 'release.version',
    name: 'release.version',
  },
  'release.build': {
    key: 'release.build',
    name: 'release.build',
  },
  'release.package': {
    key: 'release.package',
    name: 'release.package',
  },
  'release.stage': {
    key: 'release.stage',
    name: 'release.stage',
    predefined: true,
    values: Object.keys(ADOPTION_STAGE_LABELS),
  },
  release: {
    key: 'release',
    name: 'release',
  },
};

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
    <SmartSearchBar
      searchSource="project_filters"
      query={query}
      placeholder={t('Search by release version')}
      maxSearchItems={5}
      hasRecentSearches={false}
      supportedTags={supportedTags}
      onSearch={onSearch}
      onGetTagValues={getTagValues}
    />
  );
}

export default ProjectFilters;
