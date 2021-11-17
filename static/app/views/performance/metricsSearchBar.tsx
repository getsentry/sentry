import {useEffect, useState} from 'react';
import {ClassNames} from '@emotion/react';
import memoize from 'lodash/memoize';

import {addErrorMessage} from 'app/actionCreators/indicator';
import SmartSearchBar from 'app/components/smartSearchBar';
import {NEGATION_OPERATOR, SEARCH_WILDCARD} from 'app/constants';
import {t} from 'app/locale';
import {Organization, Tag} from 'app/types';
import useApi from 'app/utils/useApi';
import useProjects from 'app/utils/useProjects';

const SEARCH_SPECIAL_CHARS_REGEXP = new RegExp(
  `^${NEGATION_OPERATOR}|\\${SEARCH_WILDCARD}`,
  'g'
);

type Props = Pick<
  React.ComponentProps<typeof SmartSearchBar>,
  'onSearch' | 'onBlur' | 'query' | 'maxQueryLength' | 'searchSource'
> & {
  orgSlug: Organization['slug'];
  /**
   * This is a temp solution, since the metrics tags endpoint currently only
   * supports one project selection but it wwill soon support multiple projects
   */
  projectId: number;
};

function MetricsSearchBar({
  orgSlug,
  projectId,
  onSearch,
  onBlur,
  maxQueryLength,
  searchSource,
}: Props) {
  const api = useApi();
  const {projects} = useProjects();
  const [tags, setTags] = useState<string[]>([]);

  const projectSlug = projects.find(project => project.id === String(projectId))?.slug;

  useEffect(() => {
    fetchTags();
  }, [projectSlug]);

  async function fetchTags() {
    if (!projectSlug) {
      return;
    }

    try {
      const response = await api.requestPromise(
        `/projects/${orgSlug}/${projectSlug}/metrics/tags/`
      );
      setTags(response);
    } catch {
      addErrorMessage(t('Unable to fetch search bar tags'));
    }
  }

  /**
   * Prepare query string (e.g. strip special characters like negation operator)
   */
  function prepareQuery(query: string) {
    return query.replace(SEARCH_SPECIAL_CHARS_REGEXP, '');
  }

  function fetchTagValues(tagKey: string) {
    return api.requestPromise(
      `/projects/${orgSlug}/${projectSlug}/metrics/tags/${tagKey}/`,
      {
        method: 'GET',
      }
    );
  }

  function getTagValues(tag: Tag, _query: string): Promise<string[]> {
    return fetchTagValues(tag.key).then(
      tagValues => tagValues,
      () => {
        throw new Error('Unable to fetch tag values');
      }
    );
  }

  const supportedTags = tags.reduce((acc, tag) => {
    acc[tag] = {key: tag, name: tag};
    return acc;
  }, {});

  return (
    <ClassNames>
      {({css}) => (
        <SmartSearchBar
          onGetTagValues={memoize(getTagValues, ({key}, query) => `${key}-${query}`)}
          supportedTags={supportedTags}
          prepareQuery={prepareQuery}
          excludeEnvironment
          dropdownClassName={css`
            max-height: 300px;
            overflow-y: auto;
          `}
          onSearch={onSearch}
          onBlur={onBlur}
          maxQueryLength={maxQueryLength}
          searchSource={searchSource}
          hasRecentSearches
        />
      )}
    </ClassNames>
  );
}

export default MetricsSearchBar;
