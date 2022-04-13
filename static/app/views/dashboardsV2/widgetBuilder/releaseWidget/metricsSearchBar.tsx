import {ClassNames} from '@emotion/react';

import SmartSearchBar from 'sentry/components/smartSearchBar';
import {NEGATION_OPERATOR, SEARCH_WILDCARD} from 'sentry/constants';
import {Organization} from 'sentry/types';

import {SESSION_TAGS} from './fields';

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
  onSearch,
  onBlur,
  maxQueryLength,
  searchSource,
  className,
  ...props
}: Props) {
  /**
   * Prepare query string (e.g. strip special characters like negation operator)
   */
  function prepareQuery(query: string) {
    return query.replace(SEARCH_SPECIAL_CHARS_REGEXP, '');
  }

  const supportedTags = Object.values(SESSION_TAGS).reduce((acc, key) => {
    acc[key] = {key, name: key};
    return acc;
  }, {});

  return (
    <ClassNames>
      {({css}) => (
        <SmartSearchBar
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
