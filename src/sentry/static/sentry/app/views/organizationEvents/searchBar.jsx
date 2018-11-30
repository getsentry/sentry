import {css} from 'react-emotion';
import {flatten, memoize} from 'lodash';
import PropTypes from 'prop-types';
import React from 'react';

import {COLUMNS} from 'app/views/organizationDiscover/data';
import {defined} from 'app/utils';
import {fetchEventFieldValues} from 'app/actionCreators/events';
import {fetchOrganizationTags} from 'app/actionCreators/tags';
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
    let {api, organization} = this.props;
    fetchOrganizationTags(api, organization.slug).then(results => {
      this.setState({
        tags: this.getAllTags(results.map(({key}) => key)),
      });
    });
  }

  /**
   * Returns array of tag values that substring match `query`; invokes `callback`
   * with data when ready
   */
  getEventFieldValues = memoize((tag, query) => {
    let {api, organization} = this.props;

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

  render() {
    return (
      <SmartSearchBar
        {...this.props}
        onGetTagValues={this.getEventFieldValues}
        supportedTags={this.state.tags}
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
