import React from 'react';
import {Flex} from 'grid-emotion';
import createReactClass from 'create-react-class';
import OrganizationState from 'app/mixins/organizationState';
import LoadingIndicator from 'app/components/loadingIndicator';

import Discover from './discover';
import createQueryBuilder from './queryBuilder';

import {getQueryFromQueryString} from './utils';

const OrganizationDiscoverContainer = createReactClass({
  displayName: 'OrganizationDiscoverContainer',
  mixins: [OrganizationState],

  getInitialState: function() {
    return {
      isLoading: true,
    };
  },

  componentDidMount: function() {
    const query = this.props.location.search;

    console.log('location', this.props.location);
    console.log('query is...', query);
    // TODO: validate query

    this.queryBuilder = createQueryBuilder(
      getQueryFromQueryString(query),
      this.context.organization
    );
    this.queryBuilder.load().then(() => {
      this.setState({isLoading: false});
    });
  },

  renderComingSoon: function() {
    return (
      <Flex className="organization-home" justify="center" align="center">
        something is happening here soon :)
      </Flex>
    );
  },

  renderLoading: function() {
    return (
      <div>
        <LoadingIndicator />
      </div>
    );
  },

  render() {
    const {isLoading} = this.state;
    const hasFeature = this.getFeatures().has('internal-catchall');

    if (!hasFeature) return this.renderComingSoon();

    return (
      <div className="organization-home">
        {isLoading ? (
          this.renderLoading()
        ) : (
          <Discover
            organization={this.getOrganization()}
            queryBuilder={this.queryBuilder}
          />
        )}
      </div>
    );
  },
});

export default OrganizationDiscoverContainer;
