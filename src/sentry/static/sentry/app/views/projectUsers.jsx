import jQuery from 'jquery';
import React from 'react';
import {browserHistory, Link} from 'react-router';
import ApiMixin from '../mixins/apiMixin';
import Avatar from '../components/avatar';
import LoadingError from '../components/loadingError';
import LoadingIndicator from '../components/loadingIndicator';
import Pagination from '../components/pagination';
import TimeSince from '../components/timeSince';
import utils from '../utils';
import {t} from '../locale';

export default React.createClass({
  propTypes: {
    defaultQuery: React.PropTypes.string,
  },

  mixins: [ApiMixin],

  getDefaultProps() {
    return {
      defaultQuery: '',
    };
  },

  getInitialState() {
    return {
      userList: [],
      loading: true,
      error: false,
      pageLinks: '',
      query: this.props.defaultQuery,
      ...this.getQueryStringState(this.props)
    };
  },

  componentWillMount() {
    this.fetchData();
  },

  componentWillReceiveProps(nextProps) {
    if (nextProps.location.search !== this.props.location.search) {
      this.setState(this.getQueryStringState(nextProps), this.fetchData);
    }
  },

  getQueryStringState(props) {
    let location = props.location;
    let query = (location.query.hasOwnProperty('query')
      ? location.query.query
      : this.props.defaultQuery);
    return {
      query: query,
    };
  },

  onSearch(query) {
    let targetQueryParams = {};
    if (query !== '')
      targetQueryParams.query = query;

    let {orgId, projectId} = this.props.params;
    browserHistory.pushState(null, `/${orgId}/${projectId}/audience/users/`, targetQueryParams);
  },

  fetchData() {
    this.setState({
      loading: true,
      error: false
    });

    this.api.request(this.getEndpoint(), {
      success: (data, _, jqXHR) => {
        this.setState({
          error: false,
          loading: false,
          userList: data,
          pageLinks: jqXHR.getResponseHeader('Link')
        });
      },
      error: () => {
        this.setState({
          error: true,
          loading: false
        });
      }
    });
  },

  getEndpoint() {
    let params = this.props.params;
    let queryParams = {
      ...this.props.location.query,
      limit: 50,
      query: this.state.query,
    };

    return `/projects/${params.orgId}/${params.projectId}/users/?${jQuery.param(queryParams)}`;
  },

  getDisplayName(user) {
    return (
      user.username ||
      user.email ||
      user.identifier ||
      `${user.ipAddress} (anonymous)`
    );
  },

  renderLoading() {
    return (
      <div className="box">
        <LoadingIndicator />
      </div>
    );
  },

  renderNoQueryResults() {
    return (
      <div className="box empty-stream">
        <span className="icon icon-exclamation" />
        <p>{t('Sorry, no results match your search query.')}</p>
      </div>
    );
  },

  renderEmpty() {
    return (
      <div className="box empty-stream">
        <span className="icon icon-exclamation" />
        <p>{t('No user reports have been collected for this project.')}</p>
        <p><Link to={this.getUserReportsUrl()}>{t('Learn how to integrate User Feedback')}</Link></p>
      </div>
    );
  },

  renderResults() {
    let {orgId, projectId} = this.props.params;
    return (
      <ul>
        {this.state.userList.map((user) => {
          let link = `/${orgId}/${projectId}/audience/users/${user.hash}/`;
          return (
            <li key={user.id}>
              <Avatar user={user} size={64} className="avatar" />
              <Link to={link}>{this.getDisplayName(user)}</Link>
            </li>
          );
        })}
      </ul>
    );
  },

  renderBody() {
    if (this.state.loading)
      return <div className="box"><LoadingIndicator /></div>;
    else if (this.state.error)
      return <LoadingError onRetry={this.fetchData} />;
    else if (this.state.userList.length > 0)
      return this.renderResults();
    else if (this.state.query && this.state.query !== this.props.defaultQuery)
      return this.renderNoQueryResults();
    else
      return this.renderEmpty();
  },

  render() {
    return (
      <div>
        {this.renderBody()}
        <Pagination pageLinks={this.state.pageLinks} />
      </div>
    );
  }
});
