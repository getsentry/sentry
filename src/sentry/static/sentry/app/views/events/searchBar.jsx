import {css} from 'react-emotion';
import flatten from 'lodash/flatten';
import memoize from 'lodash/memoize';
import PropTypes from 'prop-types';
import React from 'react';

import {NEGATION_OPERATOR, SEARCH_TYPES, SEARCH_WILDCARD} from 'app/constants';
import {addErrorMessage} from 'app/actionCreators/indicator';
import {defined} from 'app/utils';
import {fetchOrganizationTags, fetchTagValues} from 'app/actionCreators/tags';
import {t} from 'app/locale';
import SentryTypes from 'app/sentryTypes';
import SmartSearchBar from 'app/components/smartSearchBar';
import withApi from 'app/utils/withApi';

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
    projectIds: PropTypes.arrayOf(PropTypes.number),
  };

  state = {
    tags: {},
  };

  componentDidMount() {
    this.fetchData();
  }

  componentDidUpdate(prevProps) {
    if (this.props.projectIds !== prevProps.projectIds) {
      this.fetchData();
      // Clear memoized data when projects change.
      this.getEventFieldValues.cache.clear();
    }
  }

  fetchData = async () => {
    const {api, organization, projectIds} = this.props;
    try {
      const tags = await fetchOrganizationTags(api, organization.slug, projectIds);
      this.setState({
        tags: this.getAllTags(tags.map(({key}) => key)),
      });
    } catch (_) {
      addErrorMessage(t('There was a problem fetching tags'));
    }
  };

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
      <SmartSearchBar
        {...this.props}
        hasRecentSearches
        savedSearchType={SEARCH_TYPES.EVENT}
        onGetTagValues={this.getEventFieldValues}
        supportedTags={this.state.tags}
        prepareQuery={this.prepareQuery}
        excludeEnvironment
        dropdownClassName={css`
          max-height: 300px;
          overflow-y: auto;
        `}
      />
    );
  }
}

export default withApi(SearchBar);
