import React from 'react';
import {Flex} from 'grid-emotion';
import createReactClass from 'create-react-class';
import {browserHistory} from 'react-router';
import OrganizationState from 'app/mixins/organizationState';
import LoadingIndicator from 'app/components/loadingIndicator';
import {t} from 'app/locale';

import Discover from './discover';
import createQueryBuilder from './queryBuilder';

import {
  getQueryFromQueryString,
  fetchSavedQuery,
  parseSavedQuery,
  getView,
} from './utils';

import {
  DiscoverWrapper,
  DiscoverContainer,
  Sidebar,
  Body,
  PageTitle,
  TopBar,
  LoadingContainer,
} from './styles';

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
      this.fetchSavedQuery(savedQueryId).then(this.loadTags);
    } else {
      this.queryBuilder = createQueryBuilder(
        getQueryFromQueryString(search),
        organization
      );
      this.loadTags();
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

  loadTags: function() {
    this.queryBuilder.load().then(() => {
      this.setState({isLoading: false});
    });
  },

  fetchSavedQuery: function(savedQueryId) {
    const {organization} = this.context;

    return fetchSavedQuery(organization, savedQueryId)
      .then(resp => {
        if (this.queryBuilder) {
          this.queryBuilder.reset(resp);
        } else {
          this.queryBuilder = createQueryBuilder(parseSavedQuery(resp), organization);
        }

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

  toggleEditMode: function() {
    const {organization} = this.context;
    const {savedQuery} = this.state;
    const isEditingSavedQuery = this.props.location.query.editing === 'true';

    const newQuery = {...this.props.location.query};
    if (!isEditingSavedQuery) {
      newQuery.editing = 'true';
    } else {
      delete newQuery.editing;
    }

    browserHistory.push({
      pathname: `/organizations/${organization.slug}/discover/saved/${savedQuery.id}/`,
      query: newQuery,
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
      <DiscoverContainer>
        <Sidebar>
          <PageTitle>{t('Discover')}</PageTitle>
        </Sidebar>
        <Body>
          <TopBar />
          <LoadingContainer>
            <LoadingIndicator />
          </LoadingContainer>
        </Body>
      </DiscoverContainer>
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
            isEditingSavedQuery={this.props.location.query.editing === 'true'}
            updateSavedQueryData={this.updateSavedQuery}
            view={view}
            toggleEditMode={this.toggleEditMode}
          />
        )}
      </DiscoverWrapper>
    );
  },
});

export default OrganizationDiscoverContainer;
