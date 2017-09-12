import React from 'react';
import {browserHistory} from 'react-router';

import ApiMixin from '../mixins/apiMixin';
import GroupState from '../mixins/groupState';
import LoadingError from '../components/loadingError';
import LoadingIndicator from '../components/loadingIndicator';
import Pagination from '../components/pagination';
import SearchBar from '../components/searchBar';
import EventsTable from '../components/eventsTable/eventsTable';
import {t} from '../locale';

const GroupEvents = React.createClass({
  mixins: [ApiMixin, GroupState],

  getInitialState() {
    let queryParams = this.props.location.query;
    return {
      eventList: [],
      loading: true,
      error: false,
      pageLinks: '',
      query: queryParams.query || ''
    };
  },

  componentWillMount() {
    this.fetchData();
  },

  componentWillReceiveProps(nextProps) {
    if (
      nextProps.params.groupId !== this.props.params.groupId ||
      nextProps.location.search !== this.props.location.search
    ) {
      let queryParams = nextProps.location.query;
      this.setState(
        {
          query: queryParams.query
        },
        this.fetchData
      );
    }
  },

  onSearch(query) {
    let targetQueryParams = {};
    if (query !== '') targetQueryParams.query = query;

    let {groupId, orgId, projectId} = this.props.params;
    browserHistory.pushState(
      null,
      `/${orgId}/${projectId}/issues/${groupId}/events/`,
      targetQueryParams
    );
  },

  getEndpoint() {
    let params = this.props.params;
    let queryParams = {
      ...this.props.location.query,
      limit: 50,
      query: this.state.query
    };

    return `/issues/${params.groupId}/events/?${jQuery.param(queryParams)}`;
  },

  fetchData() {
    let queryParams = this.props.location.query;

    this.setState({
      loading: true,
      error: false
    });

    this.api.request(this.getEndpoint(), {
      method: 'GET',
      data: queryParams,
      success: (data, _, jqXHR) => {
        this.setState({
          eventList: data,
          error: false,
          loading: false,
          pageLinks: jqXHR.getResponseHeader('Link')
        });
      },
      error: err => {
        let error = err.responseJSON || true;
        error = error.detail || true;
        this.setState({
          error,
          loading: false
        });
      }
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
            placeholder={t('search event message or tags')}
            query={this.state.query}
            onSearch={this.onSearch}
          />
        </div>
        {this.renderBody()}
      </div>
    );
  }
});

export default GroupEvents;
