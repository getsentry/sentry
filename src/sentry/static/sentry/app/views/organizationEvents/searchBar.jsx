import {css} from 'react-emotion';
import {flatten, memoize} from 'lodash';
import PropTypes from 'prop-types';
import React from 'react';

import {COLUMNS} from 'app/views/organizationDiscover/data';
import {NEGATION_OPERATOR, SEARCH_WILDCARD} from 'app/constants';
import {addErrorMessage} from 'app/actionCreators/indicator';
import {defined} from 'app/utils';
import {fetchEventFieldValues} from 'app/actionCreators/events';
import {fetchOrganizationTags} from 'app/actionCreators/tags';
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

const TAGS = COLUMNS.map(({name}) => name);

const SEARCH_SPECIAL_CHARS_REGEXP = new RegExp(
  `^${NEGATION_OPERATOR}|\\${SEARCH_WILDCARD}`,
  'g'
);

class SearchBar extends React.PureComponent {
  static propTypes = {
    api: PropTypes.object,
    organization: SentryTypes.Organization,
  };

  constructor() {
    super();

    this.state = {
      tags: {},
    };
  }

  componentDidMount() {
    const {api, organization} = this.props;
    fetchOrganizationTags(api, organization.slug).then(
      results => {
        this.setState({
          tags: this.getAllTags(results.map(({key}) => key)),
        });
      },
      () => addErrorMessage(t('There was a problem fetching tags'))
    );
  }

  /**
   * Returns array of tag values that substring match `query`; invokes `callback`
   * with data when ready
   */
  getEventFieldValues = memoize((tag, query) => {
    const {api, organization} = this.props;

    return fetchEventFieldValues(api, organization.slug, tag.key, query).then(
      results => flatten(results.filter(({name}) => defined(name)).map(({name}) => name)),
      () => {
        throw new Error('Unable to fetch event field values');
      }
    );
  }, ({key}, query) => `${key}-${query}`);

  getAllTags = (orgTags = []) =>
    TAGS.concat(orgTags)
      .sort()
      .reduce(tagToObjectReducer, {});

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
