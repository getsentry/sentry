import PropTypes from 'prop-types';
import React from 'react';
import createReactClass from 'create-react-class';
import {browserHistory} from 'react-router';
import {omit, isEqual} from 'lodash';
import qs from 'query-string';

import SentryTypes from 'app/proptypes';
import ProjectLink from 'app/components/projectLink';
import ApiMixin from 'app/mixins/apiMixin';
import DateTime from 'app/components/dateTime';
import Avatar from 'app/components/avatar';
import LoadingError from 'app/components/loadingError';
import LoadingIndicator from 'app/components/loadingIndicator';
import Pagination from 'app/components/pagination';
import SearchBar from 'app/components/searchBar';
import {t} from 'app/locale';
import withEnvironmentInQueryString from 'app/utils/withEnvironmentInQueryString';
import EmptyStateWarning from 'app/components/emptyStateWarning';

const ProjectEvents = createReactClass({
  displayName: 'ProjectEvents',

  propTypes: {
    defaultQuery: PropTypes.string,
    setProjectNavSection: PropTypes.func,
    environment: SentryTypes.Environment,
  },

  mixins: [ApiMixin],

  getDefaultProps() {
    return {
      defaultQuery: '',
    };
  },

  getInitialState() {
    let queryParams = this.props.location.query;

    return {
      eventList: [],
      loading: true,
      error: false,
      query: queryParams.query || this.props.defaultQuery,
      pageLinks: '',
      environment: this.props.environment,
    };
  },

  componentWillMount() {
    this.props.setProjectNavSection('events');
    this.fetchData();
  },

  componentWillReceiveProps(nextProps) {
    // omit when environment changes in query string since we handle that separately
    const searchHasChanged = !isEqual(
      omit(qs.parse(nextProps.location.search), 'environment'),
      omit(qs.parse(this.props.location.search), 'environment')
    );

    if (searchHasChanged) {
      let queryParams = nextProps.location.query;
      this.setState(
        {
          query: queryParams.query,
        },
        this.fetchData
      );
    }

    if (nextProps.environment !== this.props.environment) {
      this.setState({environment: nextProps.environment}, this.fetchData);
    }
  },

  onSearch(query) {
    let targetQueryParams = {};
    if (query !== '') targetQueryParams.query = query;

    let {orgId, projectId} = this.props.params;
    browserHistory.push({
      pathname: `/${orgId}/${projectId}/events/`,
      query: targetQueryParams,
    });
  },

  fetchData() {
    this.setState({
      loading: true,
      error: false,
    });

    const {params} = this.props;

    const query = {
      ...this.props.location.query,
      limit: 50,
      query: this.state.query,
    };

    if (this.state.environment) {
      query.environment = this.state.environment.name;
    } else {
      delete query.environment;
    }

    this.api.request(`/projects/${params.orgId}/${params.projectId}/events/`, {
      query,
      success: (data, _, jqXHR) => {
        this.setState({
          error: false,
          loading: false,
          eventList: data,
          pageLinks: jqXHR.getResponseHeader('Link'),
        });
      },
      error: () => {
        this.setState({
          error: true,
          loading: false,
        });
      },
    });
  },

  getEventTitle(event) {
    return event.message.split('\n')[0].substr(0, 100);
  },

  renderStreamBody() {
    let body;

    if (this.state.loading) body = this.renderLoading();
    else if (this.state.error) body = <LoadingError onRetry={this.fetchData} />;
    else if (this.state.eventList.length > 0) body = this.renderResults();
    else if (this.state.query && this.state.query !== this.props.defaultQuery)
      body = this.renderNoQueryResults();
    else body = this.renderEmpty();

    return body;
  },

  renderLoading() {
    return <LoadingIndicator />;
  },

  renderNoQueryResults() {
    return (
      <EmptyStateWarning>
        <p>{t('Sorry, no events match your filters.')}</p>
      </EmptyStateWarning>
    );
  },

  renderEmpty() {
    return (
      <EmptyStateWarning>
        <p>{t("There don't seem to be any events.")}</p>
      </EmptyStateWarning>
    );
  },

  renderResults() {
    let {orgId, projectId} = this.props.params;

    let children = this.state.eventList.map((event, eventIdx) => {
      return (
        <tr key={event.id}>
          <td style={{width: 240}}>
            <small>
              <DateTime date={event.dateCreated} />
            </small>
          </td>
          <td>
            <h5>
              <ProjectLink
                to={`/${orgId}/${projectId}/issues/${event.groupID}/events/${event.id}/`}
              >
                {this.getEventTitle(event)}
              </ProjectLink>
            </h5>
          </td>
          <td className="event-user table-user-info" style={{textAlign: 'right'}}>
            {event.user ? (
              <div>
                <Avatar user={event.user} />
                {event.user.email}
              </div>
            ) : (
              <span>—</span>
            )}
          </td>
        </tr>
      );
    });

    return (
      <table className="table">
        <tbody>{children}</tbody>
      </table>
    );
  },

  render() {
    return (
      <div>
        <div className="row release-list-header">
          <div className="col-sm-7">
            <h3>{t('Events')}</h3>
          </div>
          <div className="col-sm-5 release-search">
            <SearchBar
              defaultQuery=""
              placeholder={t('Search event message')}
              query={this.state.query}
              onSearch={this.onSearch}
            />
          </div>
        </div>
        <div className="alert alert-block alert-info">
          {t(`Psst! This feature is still a work-in-progress. Thanks for being an early
          adopter!`)}
        </div>
        <div className="event-list">{this.renderStreamBody()}</div>
        <Pagination pageLinks={this.state.pageLinks} />
      </div>
    );
  },
});

export default withEnvironmentInQueryString(ProjectEvents);
