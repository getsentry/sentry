import {ClassNames} from '@emotion/core';
import assign from 'lodash/assign';
import flatten from 'lodash/flatten';
import isEqual from 'lodash/isEqual';
import memoize from 'lodash/memoize';
import omit from 'lodash/omit';
import PropTypes from 'prop-types';
import React from 'react';

import {NEGATION_OPERATOR, SEARCH_WILDCARD} from 'app/constants';
import {defined} from 'app/utils';
import {fetchTagValues} from 'app/actionCreators/tags';
import SentryTypes from 'app/sentryTypes';
import SmartSearchBar, {SearchType} from 'app/components/smartSearchBar';
import {FIELDS, TRACING_FIELDS} from 'app/utils/discover/fields';
import withApi from 'app/utils/withApi';
import withTags from 'app/utils/withTags';

const SEARCH_SPECIAL_CHARS_REGEXP = new RegExp(
  `^${NEGATION_OPERATOR}|\\${SEARCH_WILDCARD}`,
  'g'
);

const FIELD_TAGS = Object.fromEntries(
  Object.keys(FIELDS).map(item => [item, {key: item, name: item}])
);

class SearchBar extends React.PureComponent {
  static propTypes = {
    api: PropTypes.object,
    organization: SentryTypes.Organization,
    tags: PropTypes.objectOf(SentryTypes.Tag),
    omitTags: PropTypes.arrayOf(PropTypes.string),
    projectIds: PropTypes.arrayOf(PropTypes.number),
    fields: PropTypes.arrayOf(PropTypes.object),
  };

  componentDidMount() {
    // Clear memoized data on mount to make tests more consistent.
    this.getEventFieldValues.cache.clear();
  }

  componentDidUpdate(prevProps) {
    if (!isEqual(this.props.projectIds, prevProps.projectIds)) {
      // Clear memoized data when projects change.
      this.getEventFieldValues.cache.clear();
    }
  }

  /**
   * Returns array of tag values that substring match `query`; invokes `callback`
   * with data when ready
   */
  getEventFieldValues = memoize(
    (tag, query, endpointParams) => {
      const {api, organization, projectIds} = this.props;

      return fetchTagValues(
        api,
        organization.slug,
        tag.key,
        query,
        projectIds,
        endpointParams
      ).then(
        results =>
          flatten(results.filter(({name}) => defined(name)).map(({name}) => name)),
        () => {
          throw new Error('Unable to fetch event field values');
        }
      );
    },
    ({key}, query) => `${key}-${query}`
  );

  /**
   * Prepare query string (e.g. strip special characters like negation operator)
   */
  prepareQuery = query => query.replace(SEARCH_SPECIAL_CHARS_REGEXP, '');

  getTagList() {
    const {fields, organization, tags, omitTags} = this.props;
    const functionTags = fields
      ? Object.fromEntries(
          fields
            .filter(item => !Object.keys(FIELD_TAGS).includes(item.field))
            .map(item => [item.field, {key: item.field, name: item.field}])
        )
      : {};

    const fieldTags = organization.features.includes('performance-view')
      ? assign(FIELD_TAGS, functionTags)
      : omit(FIELD_TAGS, TRACING_FIELDS);

    const combined = assign({}, tags, fieldTags);
    combined.has = {
      key: 'has',
      name: 'Has property',
      values: Object.keys(combined),
      predefined: true,
    };

    return omit(combined, omitTags ?? []);
  }

  render() {
    const tags = this.getTagList();
    return (
      <ClassNames>
        {({css}) => (
          <SmartSearchBar
            {...this.props}
            hasRecentSearches
            savedSearchType={SearchType.EVENT}
            onGetTagValues={this.getEventFieldValues}
            supportedTags={tags}
            prepareQuery={this.prepareQuery}
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
}

export default withApi(withTags(SearchBar));
