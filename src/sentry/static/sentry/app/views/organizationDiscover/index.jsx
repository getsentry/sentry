import React from 'react';
import {Flex} from 'grid-emotion';
import {browserHistory} from 'react-router';
import DocumentTitle from 'react-document-title';
import jQuery from 'jquery';
import SentryTypes from 'app/sentryTypes';

import Discover from './discover';
import createQueryBuilder from './queryBuilder';

import {
  getQueryFromQueryString,
  fetchSavedQuery,
  parseSavedQuery,
  getView,
} from './utils';

import {DiscoverWrapper} from './styles';

export default class OrganizationDiscoverContainer extends React.Component {
  static contextTypes = {
    organization: SentryTypes.Organization,
  };

  constructor(props, context) {
    super(props, context);

    this.state = {
      isLoading: true,
      savedQuery: null,
      view: getView(props.params, props.location.query.view),
    };

    const {search} = props.location;
    const {organization} = context;

    this.queryBuilder = createQueryBuilder(getQueryFromQueryString(search), organization);
  }

  componentDidMount() {
    jQuery(document.body).addClass('body-discover');

    const {savedQueryId} = this.props.params;

    if (savedQueryId) {
      this.fetchSavedQuery(savedQueryId).then(this.loadTags);
    } else {
      this.loadTags();
    }
  }

  componentWillReceiveProps(nextProps) {
    if (!nextProps.params.savedQueryId) {
      this.setState({savedQuery: null});
      return;
    }

    if (nextProps.params.savedQueryId !== this.props.params.savedQueryId) {
      this.fetchSavedQuery(nextProps.params.savedQueryId);
    }

    if (nextProps.location.query.view !== this.props.location.query.view) {
      this.setState({view: getView(nextProps.params, nextProps.location.query.view)});
    }
  }

  componentWillUnmount() {
    jQuery(document.body).removeClass('body-discover');
  }

  loadTags = () => {
    this.queryBuilder.load().then(() => {
      this.setState({isLoading: false});
    });
  };

  fetchSavedQuery = savedQueryId => {
    const {organization} = this.context;

    return fetchSavedQuery(organization, savedQueryId)
      .then(resp => {
        if (this.queryBuilder) {
          this.queryBuilder.reset(parseSavedQuery(resp));
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
  };

  updateSavedQuery = savedQuery => {
    this.setState({savedQuery});
  };

  toggleEditMode = () => {
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
  };

  renderComingSoon() {
    return (
      <Flex className="organization-home" justify="center" align="center">
        something is happening here soon :)
      </Flex>
    );
  }

  render() {
    const {isLoading, savedQuery, view} = this.state;

    const {location, params} = this.props;

    const {organization} = this.context;
    const hasFeature = new Set(organization.features).has('discover');

    if (!hasFeature) return this.renderComingSoon();

    return (
      <DocumentTitle title={`Discover - ${organization.slug} - Sentry`}>
        <DiscoverWrapper>
          <Discover
            isLoading={isLoading}
            organization={organization}
            queryBuilder={this.queryBuilder}
            location={location}
            params={params}
            savedQuery={savedQuery}
            isEditingSavedQuery={this.props.location.query.editing === 'true'}
            updateSavedQueryData={this.updateSavedQuery}
            view={view}
            toggleEditMode={this.toggleEditMode}
          />
        </DiscoverWrapper>
      </DocumentTitle>
    );
  }
}
