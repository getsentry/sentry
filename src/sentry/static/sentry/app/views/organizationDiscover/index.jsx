import React from 'react';
import {Flex} from 'grid-emotion';
import createReactClass from 'create-react-class';
import OrganizationState from 'app/mixins/organizationState';
import LoadingIndicator from 'app/components/loadingIndicator';

import Discover from './discover';
import createQueryBuilder from './queryBuilder';

import {getQueryFromQueryString} from './utils';
import {Loading} from './styles';

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
      <Loading>
        <LoadingIndicator />
      </Loading>
    );
  },

  render() {
    const {isLoading} = this.state;
    const hasFeature = this.getFeatures().has('discover');

    if (!hasFeature) return this.renderComingSoon();

    return (
      <div>
        {isLoading ? (
          this.renderLoading()
        ) : (
          <Discover
            organization={this.getOrganization()}
            queryBuilder={this.queryBuilder}
            location={this.props.location}
          />
        )}
      </div>
    );
  },
});

export default OrganizationDiscoverContainer;
