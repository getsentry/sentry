import jQuery from 'jquery';
import React from 'react';
import {History} from 'react-router';
import api from '../../api';
import LoadingError from '../../components/loadingError';
import LoadingIndicator from '../../components/loadingIndicator';
import Pagination from '../../components/pagination';
import SearchBar from '../../components/searchBar.jsx';

import ReleaseList from './releaseList';

const ProjectReleases = React.createClass({
  propTypes: {
    setProjectNavSection: React.PropTypes.func
  },

  mixins: [ History ],

  getDefaultProps() {
    return {
      defaultQuery: ''
    };
  },

  getInitialState() {
    let queryParams = this.props.location.query;

    return {
      releaseList: [],
      loading: true,
      error: false,
      query: queryParams.query || this.props.defaultQuery,
      pageLinks: ''
    };
  },

  componentWillMount() {
    this.props.setProjectNavSection('releases');
    this.fetchData();
  },

  componentWillReceiveProps(nextProps) {
    if (nextProps.location.search !== this.props.location.search) {
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

    let {orgId, projectId} = this.props.params;
    this.history.pushState(null, `/${orgId}/${projectId}/releases/`, targetQueryParams);
  },

  fetchData() {
    this.setState({
      loading: true,
      error: false
    });

    api.request(this.getProjectReleasesEndpoint(), {
      success: (data, _, jqXHR) => {
        this.setState({
          error: false,
          loading: false,
          releaseList: data,
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

  getProjectReleasesEndpoint() {
    let params = this.props.params;
    let queryParams = {
      ...this.props.location.query,
      limit: 50,
      query: this.state.query
    };

    return '/projects/' + params.orgId + '/' + params.projectId + '/releases/?' + jQuery.param(queryParams);
  },

  getReleaseTrackingUrl() {
    let params = this.props.params;

    return '/' + params.orgId + '/' + params.projectId + '/settings/release-tracking/';
  },

  renderStreamBody() {
    let body;

    let params = this.props.params;

    if (this.state.loading)
      body = this.renderLoading();
    else if (this.state.error)
      body = <LoadingError onRetry={this.fetchData} />;
    else if (this.state.releaseList.length > 0)
      body = <ReleaseList orgId={params.orgId} projectId={params.projectId} releaseList={this.state.releaseList} />;
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
        <p>Sorry, no releases match your filters.</p>
      </div>
    );
  },

  renderEmpty() {
    return (
      <div className="box empty-stream">
        <span className="icon icon-exclamation" />
        <p>There don't seem to be any releases yet.</p>
        <p><a href={this.getReleaseTrackingUrl()}>Learn how to integrate Release Tracking</a></p>
      </div>
    );
  },

  render() {
    return (
      <div>
        <div className="row release-list-header">
          <div className="col-sm-7">
            <h3>Releases</h3>
          </div>
          <div className="col-sm-5 release-search">
            <SearchBar defaultQuery=""
              placeholder="Search for a release."
              query={this.state.query}
              onSearch={this.onSearch}
            />
          </div>
        </div>
        <div className="release-group-header">
          <div className="row">
            <div className="col-sm-8 col-xs-6">Version</div>
            <div className="col-sm-2 col-xs-3 release-stats align-right">
              New Events
            </div>
            <div className="col-sm-2 col-xs-3 release-stats align-right">
              Last Event
            </div>
          </div>
        </div>
        {this.renderStreamBody()}
        <Pagination pageLinks={this.state.pageLinks} onPage={this.onPage} />
      </div>
    );
  }
});

export default ProjectReleases;
