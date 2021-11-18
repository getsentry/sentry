import * as React from 'react';
import {ClassNames} from '@emotion/react';
import memoize from 'lodash/memoize';

import {Client} from 'app/api';
import SmartSearchBar from 'app/components/smartSearchBar';
import {NEGATION_OPERATOR, SEARCH_WILDCARD} from 'app/constants';
import {t} from 'app/locale';
import {Organization, Project, Tag} from 'app/types';

import {MetricTagValue} from './types';

const SEARCH_SPECIAL_CHARS_REGEXP = new RegExp(
  `^${NEGATION_OPERATOR}|\\${SEARCH_WILDCARD}`,
  'g'
);

type Props = Pick<
  React.ComponentProps<typeof SmartSearchBar>,
  'onSearch' | 'onBlur' | 'query'
> & {
  api: Client;
  orgSlug: Organization['slug'];
  projectId: Project['id'];
  tags: string[];
};

function SearchQueryField({api, orgSlug, projectId, tags, onSearch, onBlur}: Props) {
  /**
   * Prepare query string (e.g. strip special characters like negation operator)
   */
  function prepareQuery(query: string) {
    return query.replace(SEARCH_SPECIAL_CHARS_REGEXP, '');
  }

  function fetchTagValues(tagKey: string) {
    return api.requestPromise(
      `/organizations/${orgSlug}/metrics/tags/${tagKey}/?project=${projectId}`,
      {
        method: 'GET',
      }
    );
  }

  function getTagValues(tag: Tag, _query: string): Promise<string[]> {
    return fetchTagValues(tag.key).then(
      tagValues => (tagValues as MetricTagValue[]).map(({value}) => value),
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
          placeholder={t('Search for tag')}
          onGetTagValues={memoize(getTagValues, ({key}, query) => `${key}-${query}`)}
          supportedTags={supportedTags}
          prepareQuery={prepareQuery}
          onSearch={onSearch}
          onBlur={onBlur}
          useFormWrapper={false}
          excludeEnvironment
          dropdownClassName={css`
            max-height: 300px;
            overflow-y: auto;
          `}
        />
      )}
    </ClassNames>
  );
}

export default SearchQueryField;
