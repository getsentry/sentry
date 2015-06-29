var React = require("react");
var Reflux = require("reflux");
var Router = require("react-router");

var api = require("../api");
var BreadcrumbMixin = require("../mixins/breadcrumbMixin");
var LoadingError = require("../components/loadingError");
var LoadingIndicator = require("../components/loadingIndicator");
var PropTypes = require("../proptypes");
var TimeSince = require("../components/timeSince");
var utils = require("../utils");

var GroupDetails = React.createClass({
  contextTypes: {
    router: React.PropTypes.func
  },

  mixins: [
    BreadcrumbMixin
  ],

  propTypes: {
    setProjectNavSection: React.PropTypes.func.isRequired
  },

  crumbReservations: 1,

  childContextTypes: {
    release: PropTypes.AnyModel,
  },

  getChildContext() {
    return {
      release: this.state.release,
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
    this.setBreadcrumbs([
      {name: params.version, to: 'releaseDetails'}
    ]);
    this.props.setProjectNavSection('releases');
    this.fetchData();
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

    return (
      <div className={this.props.className}>
        <div className="release-details">
          <div className="row">
            <div className="col-md-7">
              <h2>Release <strong>7.7.0.dev0</strong></h2>
              <div className="release-meta">
                <span className="icon icon-clock"></span> <TimeSince date={release.dateCreated} /> by <a href="#">dcramer</a>
              </div>
            </div>
            <div className="col-md-5">
              <div className="row release-stats">
                <div className="col-md-4">
                  <h6 className="nav-header">events</h6>
                  <div className="release-count">123</div>
                </div>
                <div className="col-md-4">
                  <h6 className="nav-header">users</h6>
                  <div className="release-count">123</div>
                </div>
                <div className="col-md-4">
                  <h6 className="nav-header">servers</h6>
                  <div className="release-count">123</div>
                </div>
              </div>
            </div>
          </div>
          <ul className="nav nav-tabs">
            <li className="active"><a>Caused by this release</a></li>
            <li><a>Seen in this release</a></li>
          </ul>
        </div>
        <div className="well blankslate">grouped results</div>
      </div>
    );
  }
});

module.exports = GroupDetails;
