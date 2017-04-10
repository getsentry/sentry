import jQuery from 'jquery';
import React from 'react';
import {browserHistory, Link} from 'react-router';
import ApiMixin from '../mixins/apiMixin';
import Avatar from '../components/avatar';
import GroupStore from '../stores/groupStore';
import LoadingError from '../components/loadingError';
import LoadingIndicator from '../components/loadingIndicator';
import Pagination from '../components/pagination';
import CompactIssue from '../components/compactIssue';
import TimeSince from '../components/timeSince';
import utils from '../utils';
import {t} from '../locale';

const ProjectUserReports = React.createClass({
  propTypes: {
    defaultQuery: React.PropTypes.string,
    defaultStatus: React.PropTypes.string,
    setProjectNavSection: React.PropTypes.func
  },

  mixins: [ApiMixin],

  getDefaultProps() {
    return {
      defaultQuery: '',
      defaultStatus: 'unresolved',
    };
  },

  getInitialState() {
    return {
      reportList: [],
      loading: true,
      error: false,
      pageLinks: '',
      query: this.props.defaultQuery,
      status: this.props.defaultStatus,
      ...this.getQueryStringState(this.props)
    };
  },

  componentWillMount() {
    this.props.setProjectNavSection('user-feedback');
    this.fetchData();
  },

  componentWillReceiveProps(nextProps) {
    if (nextProps.location.search !== this.props.location.search) {
      this.setState(this.getQueryStringState(nextProps), this.fetchData);
    }
  },

  getQueryStringState(props) {
    let location = props.location;
    let status = (location.query.hasOwnProperty('status')
      ? location.query.status
      : this.props.defaultStatus);
    let query = (location.query.hasOwnProperty('query')
      ? location.query.query
      : this.props.defaultQuery);
    return {
      query: query,
      status: status,
    };
  },

  onSearch(query) {
    let targetQueryParams = {};
    if (query !== '')
      targetQueryParams.query = query;
    if (this.state.status !== this.props.defaultStatus)
      targetQueryParams.status = this.state.status;

    let {orgId, projectId} = this.props.params;
    browserHistory.pushState(null, `/${orgId}/${projectId}/user-feedback/`, targetQueryParams);
  },

  fetchData() {
    this.setState({
      loading: true,
      error: false
    });

    this.api.request(this.getEndpoint(), {
      success: (data, _, jqXHR) => {
        let issues = data.map(r => r.issue);
        GroupStore.add(issues);
        this.setState({
          error: false,
          loading: false,
          reportList: data,
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
      status: this.state.status,
    };

    return `/projects/${params.orgId}/${params.projectId}/user-reports/?${jQuery.param(queryParams)}`;
  },

  getUserReportsUrl() {
    let params = this.props.params;

    return `/${params.orgId}/${params.projectId}/settings/user-feedback/`;
  },

  renderStreamBody() {
    let body;

    if (this.state.loading)
      body = this.renderLoading();
    else if (this.state.error)
      body = <LoadingError onRetry={this.fetchData} />;
    else if (this.state.reportList.length > 0)
      body = this.renderResults();
    else if (this.state.query && this.state.query !== this.props.defaultQuery)
      body = this.renderNoQueryResults();
    else
      body = this.renderEmpty();

    return body;
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
    let children = this.state.reportList.map((item, itemIdx) => {
      let body = utils.nl2br(utils.urlize(utils.escape(item.comments)));
      let issue = item.issue;

      return (
        <CompactIssue
            key={item.id}
            id={issue.id}
            data={issue}
            orgId={orgId}
            projectId={projectId}>
          <div className="activity-container" style={{margin: '10px 0 5px'}}>
            <ul className="activity">
              <li className="activity-note" style={{paddingBottom: 0}}>
                <Avatar user={item} size={64} className="avatar" />
                <div className="activity-bubble">
                  <TimeSince date={item.dateCreated} />
                  <div className="activity-author">{item.name} <small>{item.email}</small></div>
                  <p dangerouslySetInnerHTML={{__html: body}} />
                </div>
              </li>
            </ul>
          </div>
        </CompactIssue>
      );
    });

    return (
      <ul className="issue-list">
        {children}
      </ul>
    );
  },

  render() {
    let path = this.props.location.pathname;
    let status = this.state.status;
    return (
      <div>
        <div className="row release-list-header">
          <div className="col-sm-9">
            <h3>{t('User Feedback')}</h3>
          </div>
          <div className="col-sm-3" style={{textAlign: 'right'}}>
            <div className="btn-group">
              <Link to={path}
                    className={'btn btn-sm btn-default' + (status === 'unresolved' ? ' active' : '')}>
                {t('Unresolved')}
              </Link>
              <Link to={{pathname: path, query: {status: ''}}}
                    className={'btn btn-sm btn-default' + (status === '' ? ' active' : '')}>
                {t('All Issues')}
              </Link>
            </div>
          </div>
        </div>
        <div className="alert alert-block alert-info">Psst! This feature is still a work-in-progress. Thanks for being an early adopter!</div>
        {this.renderStreamBody()}
        <Pagination pageLinks={this.state.pageLinks} />
      </div>
    );
  }
});

export default ProjectUserReports;
