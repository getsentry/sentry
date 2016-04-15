import React from 'react';
import {History, Link} from 'react-router';

import ApiMixin from '../mixins/apiMixin';
import DateTime from '../components/dateTime';
import Gravatar from '../components/gravatar';
import GroupState from '../mixins/groupState';
import LoadingError from '../components/loadingError';
import LoadingIndicator from '../components/loadingIndicator';
import Pagination from '../components/pagination';
import SearchBar from '../components/searchBar.jsx';
import {t} from '../locale';

const GroupEvents = React.createClass({
  mixins: [
    ApiMixin,
    GroupState,
    History
  ],

  getInitialState() {
    let queryParams = this.props.location.query;
    return {
      eventList: [],
      loading: true,
      error: false,
      pageLinks: '',
      query: queryParams.query || '',
    };
  },

  componentWillMount() {
    this.fetchData();
  },

  componentWillReceiveProps(nextProps) {
    if (nextProps.params.groupId !== this.props.params.groupId ||
        nextProps.location.search !== this.props.location.search) {
      let queryParams = nextProps.location.query;
      this.setState({
        query: queryParams.query
      }, this.fetchData);
    }
  },

  onSearch(query) {
    let targetQueryParams = {};
    if (query !== '')
      targetQueryParams.query = query;

    let {groupId, orgId, projectId} = this.props.params;
    this.history.pushState(null, `/${orgId}/${projectId}/issues/${groupId}/events/`, targetQueryParams);
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
      error: (error) => {
        this.setState({
          error: true,
          loading: false
        });
      }
    });
  },

  getEventTitle(event) {
    return event.message.split('\n')[0].substr(0, 100);
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
        <p>{t('There don\'t seem to be any events yet.')}</p>
      </div>
    );
  },

  renderResults() {
    let group = this.getGroup();
    let tagList = group.tags.filter((tag) => {
      return tag.key !== 'user';
    });

    let hasUser = false;
    for (let i = 0; i < this.state.eventList.length; i++) {
      if (this.state.eventList[i].user) {
        hasUser = true;
        break;
      }
    }

    let {orgId, projectId, groupId} = this.props.params;

    let children = this.state.eventList.map((event) => {
      let tagMap = {};
      event.tags.forEach((tag) => {
        tagMap[tag.key] = tag.value;
      });

      return (
        <tr key={event.id}>
          <td>
            <h5>
              <Link to={`/${orgId}/${projectId}/issues/${groupId}/events/${event.id}/`}>
                <DateTime date={event.dateCreated} />
              </Link>
              <small>{this.getEventTitle(event)}</small>
            </h5>
          </td>
          {tagList.map((tag) => {
            return (
              <td key={tag.key}>
                {tagMap[tag.key]}
              </td>
            );
          })}
          {hasUser &&
            <td className="event-user table-user-info">
              {event.user ?
                <div>
                  <Gravatar user={event.user} size={64} className="avatar" />
                  {event.user.email}
                </div>
              :
                <span>&mdash;</span>
              }
            </td>
          }
        </tr>
      );
    });

    return (
      <div>
        <div className="event-list">
          <table className="table">
            <thead>
              <tr>
                <th>{t('ID')}</th>
                {tagList.map((tag) => {
                  return (
                    <th key={tag.key}>
                      {tag.name}
                    </th>
                  );
                })}
                {hasUser &&
                  <th>{t('User')}</th>
                }
              </tr>
            </thead>
            <tbody>
              {children}
            </tbody>
          </table>
        </div>
        <Pagination pageLinks={this.state.pageLinks}/>
      </div>
    );
  },

  renderBody() {
    let body;

    if (this.state.loading)
      body = <LoadingIndicator />;
    else if (this.state.error)
      body = <LoadingError onRetry={this.fetchData} />;
    else if (this.state.eventList.length > 0)
      body = this.renderResults();
    else if (this.state.query && this.state.query !== '')
      body = this.renderNoQueryResults();
    else
      body = this.renderEmpty();

    return body;
  },

  render() {
    return (
      <div>
        <div style={{marginBottom: 20}}>
          <SearchBar defaultQuery=""
            placeholder="search event message"
            query={this.state.query}
            onSearch={this.onSearch} />
        </div>
        {this.renderBody()}
      </div>
    );
  }
});

export default GroupEvents;
