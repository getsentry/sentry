import SmartSearchBar from 'app/components/smartSearchBar';
import {t} from 'app/locale';
import {Tag} from 'app/types';

import {TagValueLoader} from '../issueList/types';

const supportedTags = {
  'sentry.semver': {
    key: 'sentry.semver',
    name: 'sentry.semver',
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
      query={query}
      placeholder={t('Search by release version')}
      supportedTags={supportedTags}
      onSearch={onSearch}
      onGetTagValues={getTagValues}
      onGetRecentSearches={async () => []}
    />
  );
}

export default ProjectFilters;
