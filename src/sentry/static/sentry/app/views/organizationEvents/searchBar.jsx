import {css} from 'react-emotion';
import {flatten} from 'lodash';
import PropTypes from 'prop-types';
import React from 'react';

import {COLUMNS} from 'app/views/organizationDiscover/data';
import {defined} from 'app/utils';
import {
  fetchOrganizationTagKeys,
  fetchOrganizationTagValues,
} from 'app/actionCreators/tags';
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

class SearchBar extends React.Component {
  static propTypes = {
    api: PropTypes.object,
    organization: SentryTypes.Organization,
  };

  constructor() {
    super();

    this.state = {
      tags: [],
    };
  }

  componentDidMount() {
    let {api, organization} = this.props;
    fetchOrganizationTagKeys(api, organization.slug).then(results => {
      this.setState({
        tags: results.map(({tag}) => tag),
      });
    });
  }

  /**
   * Returns array of tag values that substring match `query`; invokes `callback`
   * with data when ready
   */
  getTagValues = (tag, query) => {
    let {api, organization} = this.props;

    return fetchOrganizationTagValues(api, organization.slug, tag.key, query).then(
      results => flatten(results.filter(({name}) => defined(name)).map(({name}) => name)),
      () => {
        throw new Error('Unable to fetch project tags');
      }
    );
  };

  getAllTags = (orgTags = []) =>
    TAGS.concat(orgTags)
      .sort()
      .reduce(tagToObjectReducer, {});

  render() {
    return (
      <SmartSearchBar
        {...this.props}
        onGetTagValues={this.getTagValues}
        supportedTags={this.getAllTags(this.state.tags)}
        excludeEnvironment
        maxSearchItems={false}
        dropdownClassName={css`
          max-height: 300px;
          overflow-y: auto;
        `}
      />
    );
  }
}

export default withApi(SearchBar);
