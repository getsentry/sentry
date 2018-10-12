import React from 'react';
import {Flex} from 'grid-emotion';
import createReactClass from 'create-react-class';
import {browserHistory} from 'react-router';
import OrganizationState from 'app/mixins/organizationState';
import LoadingIndicator from 'app/components/loadingIndicator';

import Discover from './discover';
import createQueryBuilder from './queryBuilder';

import {
  getQueryFromQueryString,
  fetchSavedQuery,
  parseSavedQuery,
  getView,
} from './utils';
import {DiscoverWrapper, LoadingContainer} from './styles';

const OrganizationDiscoverContainer = createReactClass({
  displayName: 'OrganizationDiscoverContainer',
  mixins: [OrganizationState],

  getInitialState: function() {
    return {
      isLoading: true,
      savedQuery: null,
      view: getView(this.props.location.query.view),
    };
  },

  componentDidMount: function() {
    const {savedQueryId} = this.props.params;
    const {search} = this.props.location;
    const {organization} = this.context;

    if (savedQueryId) {
      this.fetchSavedQuery(savedQueryId);
    } else {
      this.queryBuilder = createQueryBuilder(
        getQueryFromQueryString(search),
        organization
      );
      this.queryBuilder.load().then(() => {
        this.setState({isLoading: false});
      });
    }
  },

  componentWillReceiveProps: function(nextProps) {
    if (!nextProps.params.savedQueryId) {
      this.setState({savedQuery: null});
      return;
    }

    if (nextProps.params.savedQueryId !== this.props.params.savedQueryId) {
      this.fetchSavedQuery(nextProps.params.savedQueryId);
    }

    if (nextProps.location.query.view !== this.props.location.query.view) {
      this.setState({view: getView(nextProps.location.query.view)});
    }
  },

  fetchSavedQuery: function(savedQueryId) {
    const {organization} = this.context;

    fetchSavedQuery(organization, savedQueryId)
      .then(resp => {
        this.queryBuilder = createQueryBuilder(parseSavedQuery(resp), organization);
        this.setState({isLoading: false, savedQuery: resp, view: 'saved'});
      })
      .catch(() => {
        browserHistory.push({
          pathname: `/organizations/${organization.slug}/discover/`,
          query: {view: 'saved'},
        });
        window.location.reload();
      });
  },

  updateSavedQuery: function(savedQuery) {
    this.setState({savedQuery});
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
      <LoadingContainer>
        <LoadingIndicator />
      </LoadingContainer>
    );
  },

  render() {
    const {isLoading, savedQuery, view} = this.state;
    const {location, params} = this.props;
    const hasFeature = this.getFeatures().has('discover');

    if (!hasFeature) return this.renderComingSoon();

    return (
      <DiscoverWrapper>
        {isLoading ? (
          this.renderLoading()
        ) : (
          <Discover
            organization={this.getOrganization()}
            queryBuilder={this.queryBuilder}
            location={location}
            params={params}
            savedQuery={savedQuery}
            updateSavedQueryData={this.updateSavedQuery}
            view={view}
          />
        )}
      </DiscoverWrapper>
    );
  },
});

export default OrganizationDiscoverContainer;
