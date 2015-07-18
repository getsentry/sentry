var React = require("react");
var Reflux = require("reflux");
var Router = require("react-router");

var api = require("../api");
var Count = require("../components/count");
var DocumentTitle = require("react-document-title");
var ListLink = require("../components/listLink");
var LoadingError = require("../components/loadingError");
var LoadingIndicator = require("../components/loadingIndicator");
var ProjectState = require("../mixins/projectState");
var PropTypes = require("../proptypes");
var StreamGroup = require("../components/streamGroup");
var TimeSince = require("../components/timeSince");
var utils = require("../utils");
var Version = require("../components/version");

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
    return 'Release ' + params.version + ' | ' + team.name + ' / ' + project.name + ' | Sentry';
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
              <div className="col-md-9">
                <Router.Link to="projectReleases" params={params} className="back-arrow">
                  <span className="icon-arrow-left"></span>
                </Router.Link>
                <h3>Release <strong><Version version={release.version} /></strong></h3>
                <div className="release-meta">
                  <span className="icon icon-clock"></span> <TimeSince date={release.dateCreated} />
                </div>
              </div>
              <div className="col-md-3">
                <div className="release-stats">
                  <h6 className="nav-header">New Events</h6>
                  <Count className="release-count" value={release.newGroups} />
                </div>
              </div>
            </div>
            <ul className="nav nav-tabs">
              <ListLink to="releaseNewEvents" params={params}>New Events</ListLink>
              <ListLink to="releaseAllEvents" params={params}>All Events</ListLink>
            </ul>
          </div>
          <Router.RouteHandler />
        </div>
      </DocumentTitle>
    );
  }
});

module.exports = ReleaseDetails;
