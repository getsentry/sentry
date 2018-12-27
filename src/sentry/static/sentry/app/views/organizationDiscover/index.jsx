import React from 'react';
import PropTypes from 'prop-types';
import {Flex} from 'grid-emotion';
import {browserHistory} from 'react-router';
import DocumentTitle from 'react-document-title';
import jQuery from 'jquery';
import SentryTypes from 'app/sentryTypes';

import {updateProjects, updateDateTime} from 'app/actionCreators/globalSelection';
import withGlobalSelection from 'app/utils/withGlobalSelection';

import Discover from './discover';
import createQueryBuilder from './queryBuilder';

import {
  getQueryFromQueryString,
  fetchSavedQuery,
  parseSavedQuery,
  getView,
} from './utils';

import {DiscoverWrapper} from './styles';

class OrganizationDiscoverContainer extends React.Component {
  static contextTypes = {
    organization: SentryTypes.Organization,
  };

  static propTypes = {
    selection: PropTypes.object.isRequired,
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

    const query = getQueryFromQueryString(search);
    if (query.hasOwnProperty('projects')) {
      // Update global store with projects from querystring
      updateProjects(query.projects);
    } else {
      // Update query with global projects
      query.projects = props.selection.projects;
    }

    if (['range', 'start', 'end'].some(key => query.hasOwnProperty(key))) {
      // Update global store with datetime from querystring
      updateDateTime({
        start: query.start || null,
        end: query.end || null,
        period: query.range || null,
      });
    } else {
      // Update query with global projects
      query.start = props.selection.datetime.start;
      query.end = props.selection.datetime.end;
      query.range = props.selection.datetime.period;
    }

    this.queryBuilder = createQueryBuilder(query, organization);
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
      // Reset querybuilder if we're switching from a saved query
      if (this.props.params.savedQueryId) {
        const projects = nextProps.selection.projects;
        this.queryBuilder.reset({projects});
      }
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

export default withGlobalSelection(OrganizationDiscoverContainer);
export {OrganizationDiscoverContainer};
