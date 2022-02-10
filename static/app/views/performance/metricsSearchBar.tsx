import {useEffect, useState} from 'react';
import {ClassNames} from '@emotion/react';
import memoize from 'lodash/memoize';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import SmartSearchBar from 'sentry/components/smartSearchBar';
import {NEGATION_OPERATOR, SEARCH_WILDCARD} from 'sentry/constants';
import {t} from 'sentry/locale';
import {MetricTag, MetricTagValue, Organization, Tag} from 'sentry/types';
import useApi from 'sentry/utils/useApi';

const SEARCH_SPECIAL_CHARS_REGEXP = new RegExp(
  `^${NEGATION_OPERATOR}|\\${SEARCH_WILDCARD}`,
  'g'
);

type Props = Pick<
  React.ComponentProps<typeof SmartSearchBar>,
  'onSearch' | 'onBlur' | 'query' | 'maxQueryLength' | 'searchSource'
> & {
  orgSlug: Organization['slug'];
  projectIds: number[] | readonly number[];
  className?: string;
};

function MetricsSearchBar({
  orgSlug,
  onSearch,
  onBlur,
  maxQueryLength,
  searchSource,
  projectIds,
  className,
  ...props
}: Props) {
  const api = useApi();
  const [tags, setTags] = useState<MetricTag[]>([]);

  useEffect(() => {
    fetchTags();
  }, [projectIds]);

  async function fetchTags() {
    try {
      const response = await api.requestPromise(
        `/organizations/${orgSlug}/metrics/tags/`,
        {
          query: {
            project: !projectIds.length ? undefined : projectIds,
          },
        }
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
    return api.requestPromise(`/organizations/${orgSlug}/metrics/tags/${tagKey}/`, {
      query: {project: projectIds},
    });
  }

  function getTagValues(tag: Tag, _query: string): Promise<string[]> {
    return fetchTagValues(tag.key).then(
      tagValues => (tagValues as MetricTagValue[]).map(({value}) => value),
      () => {
        throw new Error('Unable to fetch tag values');
      }
    );
  }

  const supportedTags = tags.reduce((acc, {key}) => {
    acc[key] = {key, name: key};
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
          className={className}
          query={props.query}
          hasRecentSearches
        />
      )}
    </ClassNames>
  );
}

export default MetricsSearchBar;
