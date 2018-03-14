import PropTypes from 'prop-types';
import React from 'react';
import createReactClass from 'create-react-class';
import {browserHistory} from 'react-router';

import SentryTypes from '../../proptypes';
import ApiMixin from '../../mixins/apiMixin';
import LoadingError from '../../components/loadingError';
import LoadingIndicator from '../../components/loadingIndicator';
import Pagination from '../../components/pagination';
import GuideAnchor from '../../components/assistant/guideAnchor';
import SearchBar from '../../components/searchBar';
import {t, tct} from '../../locale';

import ReleaseList from './releaseList';

import withEnvironmentInQueryString from '../../utils/withEnvironmentInQueryString';

const DEFAULT_QUERY = '';

const ProjectReleases = createReactClass({
  displayName: 'ProjectReleases',

  propTypes: {
    setProjectNavSection: PropTypes.func,
    environment: SentryTypes.Environment,
  },

  mixins: [ApiMixin],

  getInitialState() {
    let queryParams = this.props.location.query;

    return {
      releaseList: [],
      loading: true,
      error: false,
      query: queryParams.query || DEFAULT_QUERY,
      pageLinks: '',
      environment: this.props.environment,
    };
  },

  componentWillMount() {
    this.props.setProjectNavSection('releases');
    this.fetchData();
  },

  componentWillReceiveProps(nextProps) {
    if (nextProps.location.search !== this.props.location.search) {
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
      pathname: `/${orgId}/${projectId}/releases/`,
      query: targetQueryParams,
    });
  },

  fetchData() {
    this.setState({
      loading: true,
      error: false,
    });

    const {orgId, projectId} = this.props.params;

    const url = `/projects/${orgId}/${projectId}/releases/`;

    const query = {
      ...this.props.location.query,
      per_page: 20,
      query: this.state.query,
    };

    if (this.state.environment) {
      query.environment = this.state.environment.name;
    }

    this.api.request(url, {
      query,
      success: (data, _, jqXHR) => {
        this.setState({
          error: false,
          loading: false,
          releaseList: data,
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

  getReleaseTrackingUrl() {
    let params = this.props.params;

    return '/' + params.orgId + '/' + params.projectId + '/settings/release-tracking/';
  },

  renderStreamBody() {
    let body;

    let params = this.props.params;

    if (this.state.loading) body = this.renderLoading();
    else if (this.state.error) body = <LoadingError onRetry={this.fetchData} />;
    else if (this.state.releaseList.length > 0)
      body = (
        <ReleaseList
          orgId={params.orgId}
          projectId={params.projectId}
          releaseList={this.state.releaseList}
        />
      );
    else if (this.state.query && this.state.query !== DEFAULT_QUERY)
      body = this.renderNoQueryResults();
    else body = this.renderEmpty();

    return body;
  },

  renderLoading() {
    return <LoadingIndicator />;
  },

  renderNoQueryResults() {
    return (
      <div className="box empty-stream">
        <span className="icon icon-exclamation" />
        <p>{t('Sorry, no releases match your filters.')}</p>
      </div>
    );
  },

  renderEmpty() {
    const {environment} = this.state;
    const message = environment
      ? tct("There don't seem to be any releases in your [env] environment yet", {
          env: environment.displayName,
        })
      : t("There don't seem to be any releases yet.");

    return (
      <div className="empty-stream">
        <span className="icon icon-exclamation" />
        <p>{message}</p>
        <p>
          <a href={this.getReleaseTrackingUrl()}>
            {t('Learn how to integrate Release Tracking')}
          </a>
        </p>
      </div>
    );
  },

  render() {
    return (
      <div>
        <GuideAnchor target="releases" type="invisible" />
        <div className="row release-list-header">
          <div className="col-sm-7">
            <h3>{t('Releases')}</h3>
          </div>
          <div className="col-sm-5 release-search">
            <SearchBar
              defaultQuery=""
              placeholder={t('Search for a release')}
              query={this.state.query}
              onSearch={this.onSearch}
            />
          </div>
        </div>
        <div className="panel panel-default">
          <div className="panel-heading panel-heading-bold">
            <div className="row">
              <div className="col-sm-8 col-xs-7">{t('Version')}</div>
              <div className="col-sm-2 col-xs-3">{t('New Issues')}</div>
              <div className="col-sm-2 col-xs-2">{t('Last Event')}</div>
            </div>
          </div>
          {this.renderStreamBody()}
        </div>
        <Pagination pageLinks={this.state.pageLinks} />
      </div>
    );
  },
});

export {ProjectReleases}; // For tests
export default withEnvironmentInQueryString(ProjectReleases);
