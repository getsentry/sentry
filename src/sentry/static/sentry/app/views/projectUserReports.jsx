import jQuery from 'jquery';
import PropTypes from 'prop-types';
import React from 'react';
import createReactClass from 'create-react-class';
import {browserHistory, Link} from 'react-router';
import SentryTypes from '../proptypes';
import ApiMixin from '../mixins/apiMixin';
import GroupStore from '../stores/groupStore';
import LoadingError from '../components/loadingError';
import LoadingIndicator from '../components/loadingIndicator';
import Pagination from '../components/pagination';
import CompactIssue from '../components/compactIssue';
import EventUserReport from '../components/events/userReport';
import {t, tct} from '../locale';
import withEnvironmentInQueryString from '../utils/withEnvironmentInQueryString';

const ProjectUserReports = createReactClass({
  displayName: 'ProjectUserReports',

  propTypes: {
    defaultQuery: PropTypes.string,
    defaultStatus: PropTypes.string,
    setProjectNavSection: PropTypes.func,
    environment: SentryTypes.Environment,
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
      environment: this.props.environment,
      ...this.getQueryStringState(this.props),
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

    if (nextProps.environment !== this.props.environment) {
      this.setState(
        {
          environment: nextProps.environment,
        },
        this.fetchData
      );
    }
  },

  getQueryStringState(props) {
    let q = props.location.query;
    let status = 'status' in q ? q.status : this.props.defaultStatus;
    let query = 'query' in q ? q.query : this.props.defaultQuery;

    return {
      query,
      status,
    };
  },

  onSearch(query) {
    let targetQueryParams = {};
    if (query !== '') targetQueryParams.query = query;
    if (this.state.status !== this.props.defaultStatus)
      targetQueryParams.status = this.state.status;

    let {orgId, projectId} = this.props.params;
    browserHistory.push({
      pathname: `/${orgId}/${projectId}/user-feedback/`,
      query: targetQueryParams,
    });
  },

  fetchData() {
    this.setState({
      loading: true,
      error: false,
    });

    const query = this.state.environment
      ? {environment: this.state.environment.name}
      : null;

    this.api.request(this.getEndpoint(), {
      query,
      success: (data, _, jqXHR) => {
        let issues = data.map(r => r.issue);
        GroupStore.add(issues);
        this.setState({
          error: false,
          loading: false,
          reportList: data,
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

  getEndpoint() {
    let params = this.props.params;
    let queryParams = {
      ...this.props.location.query,
      limit: 50,
      query: this.state.query,
      status: this.state.status,
    };

    return `/projects/${params.orgId}/${params.projectId}/user-reports/?${jQuery.param(
      queryParams
    )}`;
  },

  getUserReportsUrl() {
    let params = this.props.params;

    return `/${params.orgId}/${params.projectId}/settings/user-feedback/`;
  },

  renderStreamBody() {
    let body;

    if (this.state.loading) body = this.renderLoading();
    else if (this.state.error) body = <LoadingError onRetry={this.fetchData} />;
    else if (this.state.reportList.length > 0) body = this.renderResults();
    else if (this.state.query && this.state.query !== this.props.defaultQuery)
      body = this.renderNoQueryResults();
    else body = this.renderEmpty();

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
    const {environment} = this.state;
    const message = environment
      ? tct('No user reports have been collected from your [env] environment.', {
          env: environment.displayName,
        })
      : t('No user reports have been collected.');
    return (
      <div className="box empty-stream">
        <span className="icon icon-exclamation" />
        <p>{message}</p>
        <p>
          <Link to={this.getUserReportsUrl()}>
            {t('Learn how to integrate User Feedback')}
          </Link>
        </p>
      </div>
    );
  },

  renderResults() {
    let {orgId, projectId} = this.props.params;

    let children = this.state.reportList.map((item, itemIdx) => {
      let issue = item.issue;

      return (
        <CompactIssue
          key={item.id}
          id={issue.id}
          data={issue}
          orgId={orgId}
          projectId={projectId}
        >
          <EventUserReport
            report={item}
            orgId={orgId}
            projectId={projectId}
            issueId={issue.id}
          />
        </CompactIssue>
      );
    });

    return <ul className="issue-list">{children}</ul>;
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
              <Link
                to={path}
                className={
                  'btn btn-sm btn-default' + (status === 'unresolved' ? ' active' : '')
                }
              >
                {t('Unresolved')}
              </Link>
              <Link
                to={{pathname: path, query: {status: ''}}}
                className={'btn btn-sm btn-default' + (status === '' ? ' active' : '')}
              >
                {t('All Issues')}
              </Link>
            </div>
          </div>
        </div>
        <div className="alert alert-block alert-info">
          {t(`Psst! This feature is still a work-in-progress. Thanks for being an early
          adopter!`)}
        </div>
        {this.renderStreamBody()}
        <Pagination pageLinks={this.state.pageLinks} />
      </div>
    );
  },
});

export default withEnvironmentInQueryString(ProjectUserReports);
