import {ClassNames} from '@emotion/core';
import flatten from 'lodash/flatten';
import memoize from 'lodash/memoize';
import PropTypes from 'prop-types';
import React from 'react';
import isEqual from 'lodash/isEqual';

import {NEGATION_OPERATOR, SEARCH_TYPES, SEARCH_WILDCARD} from 'app/constants';
import {defined} from 'app/utils';
import {fetchTagValues} from 'app/actionCreators/tags';
import SentryTypes from 'app/sentryTypes';
import SmartSearchBar from 'app/components/smartSearchBar';
import withApi from 'app/utils/withApi';
import withTags from 'app/utils/withTags';

const tagToObjectReducer = (acc, name) => {
  acc[name] = {
    key: name,
    name,
  };
  return acc;
};

const SEARCH_SPECIAL_CHARS_REGEXP = new RegExp(
  `^${NEGATION_OPERATOR}|\\${SEARCH_WILDCARD}`,
  'g'
);

class SearchBar extends React.PureComponent {
  static propTypes = {
    api: PropTypes.object,
    organization: SentryTypes.Organization,
    tags: PropTypes.objectOf(SentryTypes.Tag),
    projectIds: PropTypes.arrayOf(PropTypes.number),
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

  getAllTags = (orgTags = []) => orgTags.sort().reduce(tagToObjectReducer, {});

  /**
   * Prepare query string (e.g. strip special characters like negation operator)
   */
  prepareQuery = query => {
    return query.replace(SEARCH_SPECIAL_CHARS_REGEXP, '');
  };

  render() {
    return (
      <ClassNames>
        {({css}) => (
          <SmartSearchBar
            {...this.props}
            hasRecentSearches
            savedSearchType={SEARCH_TYPES.EVENT}
            onGetTagValues={this.getEventFieldValues}
            supportedTags={this.props.tags}
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
