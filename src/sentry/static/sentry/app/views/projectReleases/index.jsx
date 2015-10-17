import jQuery from "jquery";
import React from "react";
import api from "../../api";
import LoadingError from "../../components/loadingError";
import LoadingIndicator from "../../components/loadingIndicator";
import Pagination from "../../components/pagination";
import RouteMixin from "../../mixins/routeMixin";
import SearchBar from "../../components/searchBar.jsx";

import ReleaseList from "./releaseList";

var ProjectReleases = React.createClass({
  mixins: [
    RouteMixin
  ],

  getDefaultProps() {
    return {
      defaultQuery: ""
    };
  },

  contextTypes: {
    router: React.PropTypes.func
  },

  propTypes: {
    setProjectNavSection: React.PropTypes.func.isRequired
  },

  getInitialState() {
    var queryParams = this.context.router.getCurrentQuery();

    return {
      releaseList: [],
      loading: true,
      error: false,
      query: queryParams.query || this.props.defaultQuery,
      pageLinks: ''
    };
  },

  onSearch(query) {
    var router = this.context.router;

    var targetQueryParams = {};
    if (query !== '')
      targetQueryParams.query = query;

    router.transitionTo("projectReleases", router.getCurrentParams(), targetQueryParams);
  },

  componentWillMount() {
    this.props.setProjectNavSection('releases');
    this.fetchData();
  },

  routeDidChange() {
    var queryParams = this.context.router.getCurrentQuery();
    this.setState({
      query: queryParams.query
    }, this.fetchData);
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
    var router = this.context.router;
    var params = router.getCurrentParams();
    var queryParams = $.extend({}, router.getCurrentQuery());
    queryParams.limit = 50;
    queryParams.query = this.state.query;

    return '/projects/' + params.orgId + '/' + params.projectId + '/releases/?' + jQuery.param(queryParams);
  },

  onPage(cursor) {
    var router = this.context.router;
    var params = router.getCurrentParams();
    var queryParams = $.extend({}, router.getCurrentQuery());
    queryParams.cursor = cursor;

    router.transitionTo('projectReleases', params, queryParams);
  },

  getReleaseTrackingUrl() {
    var router = this.context.router;
    var params = router.getCurrentParams();

    return '/' + params.orgId + '/' + params.projectId + '/settings/release-tracking/';
  },

  renderStreamBody() {
    var body;

    if (this.state.loading)
      body = this.renderLoading();
    else if (this.state.error)
      body = <LoadingError onRetry={this.fetchData} />;
    else if (this.state.releaseList.length > 0)
      body = <ReleaseList releaseList={this.state.releaseList} />;
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
