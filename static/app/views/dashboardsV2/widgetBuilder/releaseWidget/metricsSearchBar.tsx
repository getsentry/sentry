import {ClassNames} from '@emotion/react';
import memoize from 'lodash/memoize';

import {fetchTagValues} from 'sentry/actionCreators/tags';
import SmartSearchBar from 'sentry/components/smartSearchBar';
import {NEGATION_OPERATOR, SEARCH_WILDCARD} from 'sentry/constants';
import {Organization, Tag, TagValue} from 'sentry/types';
import useApi from 'sentry/utils/useApi';

import {SESSION_STATUSES, SESSIONS_TAGS} from './fields';

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
  const tags = SESSIONS_TAGS;

  /**
   * Prepare query string (e.g. strip special characters like negation operator)
   */
  function prepareQuery(searchQuery: string) {
    return searchQuery.replace(SEARCH_SPECIAL_CHARS_REGEXP, '');
  }

  function getTagValues(tag: Tag, searchQuery: string): Promise<string[]> {
    if (tag.name === 'session.status') {
      return Promise.resolve(SESSION_STATUSES);
    }
    const projectIdStrings = projectIds?.map(String);
    return fetchTagValues(api, orgSlug, tag.key, searchQuery, projectIdStrings).then(
      tagValues => (tagValues as TagValue[]).map(({value}) => value),
      () => {
        throw new Error('Unable to fetch tag values');
      }
    );
  }

  const supportedTags = Object.values(tags).reduce((acc, key) => {
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
