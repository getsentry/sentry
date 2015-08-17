import React from "react";
import Reflux from "reflux";
import Router from "react-router";
import api from "../api";
import Count from "../components/count";
import DocumentTitle from "react-document-title";
import ListLink from "../components/listLink";
import LoadingError from "../components/loadingError";
import LoadingIndicator from "../components/loadingIndicator";
import ProjectState from "../mixins/projectState";
import PropTypes from "../proptypes";
import StreamGroup from "../components/streamGroup";
import TimeSince from "../components/timeSince";
import utils from "../utils";
import Version from "../components/version";

var ReleaseDetails = React.createClass({
  contextTypes: {
    router: React.PropTypes.func
  },

  mixins: [
    ProjectState
  ],

  propTypes: {
    setProjectNavSection: React.PropTypes.func.isRequired
  },

  childContextTypes: {
    release: PropTypes.AnyModel
  },

  getChildContext() {
    return {
      release: this.state.release
    };
  },

  getInitialState() {
    return {
      release: null,
      loading: true,
      error: false
    };
  },

  componentWillMount() {
    var params = this.context.router.getCurrentParams();
    this.props.setProjectNavSection('releases');
    this.fetchData();
  },

  getTitle() {
    var project = this.getProject();
    var team = this.getTeam();
    var params = this.context.router.getCurrentParams();
    return 'Release ' + params.version + ' | ' + team.name + ' / ' + project.name;
  },

  fetchData() {
    this.setState({
      loading: true,
      error: false
    });

    api.request(this.getReleaseDetailsEndpoint(), {
      success: (data) => {
        this.setState({
          loading: false,
          release: data
        });
      }, error: () => {
        this.setState({
          loading: false,
          error: true
        });
      }
    });
  },

  getReleaseDetailsEndpoint() {
    var params = this.context.router.getCurrentParams();
    var orgId = params.orgId;
    var projectId = params.projectId;
    var version = params.version;

    return '/projects/' + orgId + '/' + projectId + '/releases/' + version + '/';
  },

  render() {
    if (this.state.loading)
      return <LoadingIndicator />;
    else if (this.state.error)
      return <LoadingError onRetry={this.fetchData} />;

    var release = this.state.release;
    var params = this.context.router.getCurrentParams();

    return (
      <DocumentTitle title={this.getTitle()}>
        <div className={this.props.classname}>
          <div className="release-details">
            <div className="row">
              <div className="col-sm-6 col-xs-12">
                <Router.Link to="projectReleases" params={params} className="back-arrow">
                  <span className="icon-arrow-left"></span>
                </Router.Link>
                <h3>Release <strong><Version version={release.version} anchor={false} /></strong></h3>
                <div className="release-meta">
                  <span className="icon icon-clock"></span> <TimeSince date={release.dateCreated} />
                </div>
              </div>
              <div className="col-sm-2 hidden-xs">
                <div className="release-stats">
                  <h6 className="nav-header">New Events</h6>
                  <span className="stream-count"><Count value={release.newGroups} /></span>
                </div>
              </div>
              <div className="col-sm-2 hidden-xs">
                <div className="release-stats">
                  <h6 className="nav-header">First Event</h6>
                  {release.firstEvent ?
                    <span className="stream-count"><TimeSince date={release.firstEvent} /></span>
                  :
                    <span>&mdash;</span>
                  }
                </div>
              </div>
              <div className="col-sm-2 hidden-xs">
                <div className="release-stats">
                  <h6 className="nav-header">Last Event</h6>
                  {release.lastEvent ?
                    <span className="stream-count"><TimeSince date={release.lastEvent} /></span>
                  :
                    <span>&mdash;</span>
                  }
                </div>
              </div>
            </div>
            <ul className="nav nav-tabs">
              <ListLink to="releaseNewEvents" params={params}>New Events</ListLink>
              <ListLink to="releaseAllEvents" params={params}>All Events</ListLink>
              <ListLink to="releaseArtifacts" params={params} className="pull-right">Artifacts</ListLink>
            </ul>
          </div>
          <Router.RouteHandler />
        </div>
      </DocumentTitle>
    );
  }
});

export default ReleaseDetails;
