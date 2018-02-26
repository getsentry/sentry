import React from 'react';
import PropTypes from 'prop-types';
import createReactClass from 'create-react-class';
import {browserHistory} from 'react-router';

import ApiMixin from '../mixins/apiMixin';
import GroupState from '../mixins/groupState';
import LoadingError from '../components/loadingError';
import LoadingIndicator from '../components/loadingIndicator';
import Pagination from '../components/pagination';
import SearchBar from '../components/searchBar';
import EventsTable from '../components/eventsTable/eventsTable';
import {t} from '../locale';
import withEnvironment from '../utils/withEnvironment';
import {getQueryEnvironment, getQueryStringWithEnvironment} from '../utils/queryString';
import EnvironmentStore from '../stores/environmentStore';
import {setActiveEnvironment} from '../actionCreators/environments';

const GroupEvents = createReactClass({
  displayName: 'GroupEvents',

  propTypes: {
    environment: PropTypes.object,
  },

  mixins: [ApiMixin, GroupState],

  getInitialState() {
    const queryParams = this.props.location.query;

    const initialState = {
      eventList: [],
      loading: true,
      error: false,
      pageLinks: '',
      query: queryParams.query || '',
    };

    // If an environment is specified in the query, update the global environment
    // Otherwise if a global environment is present update the query
    const queryEnvironment = EnvironmentStore.getByName(
      getQueryEnvironment(queryParams.query || '')
    );

    if (queryEnvironment) {
      setActiveEnvironment(queryEnvironment);
    } else if (this.props.environment) {
      initialState.query = getQueryStringWithEnvironment(
        initialState.query,
        this.props.environment.name
      );
    }

    return initialState;
  },

  componentWillMount() {
    this.fetchData();
  },

  componentWillReceiveProps(nextProps) {
    // If query has changed, update the environment with the query environment
    if (nextProps.location.search !== this.props.location.search) {
      const queryParams = nextProps.location.query;

      const queryEnvironment = EnvironmentStore.getByName(
        getQueryEnvironment(queryParams.query || '')
      );

      if (queryEnvironment) {
        setActiveEnvironment(queryEnvironment);
      }

      this.setState(
        {
          query: queryParams.query,
        },
        this.fetchData
      );
    }

    // If environment has changed, update query with new environment
    if (nextProps.environment !== this.props.environment) {
      const newQueryString = getQueryStringWithEnvironment(
        nextProps.location.query.query || '',
        nextProps.environment ? nextProps.environment.name : null
      );
      this.setState(
        {
          query: newQueryString,
        },
        this.handleSearch(newQueryString)
      );
    }
  },

  handleSearch(query) {
    let targetQueryParams = {};
    if (query !== '') targetQueryParams.query = query;

    let {groupId, orgId, projectId} = this.props.params;
    browserHistory.push({
      pathname: `/${orgId}/${projectId}/issues/${groupId}/events/`,
      query: targetQueryParams,
    });
  },

  fetchData() {
    this.setState({
      loading: true,
      error: false,
    });

    const query = {limit: 50, query: this.state.query};

    this.api.request(`/issues/${this.props.params.groupId}/events/`, {
      query,
      method: 'GET',
      success: (data, _, jqXHR) => {
        this.setState({
          eventList: data,
          error: false,
          loading: false,
          pageLinks: jqXHR.getResponseHeader('Link'),
        });
      },
      error: err => {
        let error = err.responseJSON || true;
        error = error.detail || true;
        this.setState({
          error,
          loading: false,
        });
      },
    });
  },

  renderNoQueryResults() {
    return (
      <div className="box empty-stream">
        <span className="icon icon-exclamation" />
        <p>{t('Sorry, no events match your search query.')}</p>
      </div>
    );
  },

  renderEmpty() {
    return (
      <div className="box empty-stream">
        <span className="icon icon-exclamation" />
        <p>{t("There don't seem to be any events yet.")}</p>
      </div>
    );
  },

  renderResults() {
    let group = this.getGroup();
    let tagList = group.tags.filter(tag => tag.key !== 'user') || [];

    return (
      <div>
        <div className="event-list">
          <EventsTable
            tagList={tagList}
            events={this.state.eventList}
            params={this.props.params}
          />
        </div>
        <Pagination pageLinks={this.state.pageLinks} />
      </div>
    );
  },

  renderBody() {
    let body;

    if (this.state.loading) body = <LoadingIndicator />;
    else if (this.state.error)
      body = <LoadingError message={this.state.error} onRetry={this.fetchData} />;
    else if (this.state.eventList.length > 0) body = this.renderResults();
    else if (this.state.query && this.state.query !== '')
      body = this.renderNoQueryResults();
    else body = this.renderEmpty();

    return body;
  },

  render() {
    return (
      <div>
        <div style={{marginBottom: 20}}>
          <SearchBar
            defaultQuery=""
            placeholder={t('search event id, message, or tags')}
            query={this.state.query}
            onSearch={this.handleSearch}
          />
        </div>
        {this.renderBody()}
      </div>
    );
  },
});

export default withEnvironment(GroupEvents);
