var React = require("react");
var Reflux = require("reflux");
var Router = require("react-router");

var api = require("../api");
var LoadingError = require("../components/loadingError");
var LoadingIndicator = require("../components/loadingIndicator");
var Pagination = require("../components/pagination");
var RouteMixin = require("../mixins/routeMixin");
var TimeSince = require("../components/timeSince");
var utils = require("../utils");

var ProjectReleases = React.createClass({
  mixins: [
    RouteMixin
  ],

  contextTypes: {
    router: React.PropTypes.func
  },

  propTypes: {
    setProjectNavSection: React.PropTypes.func.isRequired
  },

  getInitialState() {
    return {
      releaseList: [],
      loading: true,
      error: false
    };
  },

  componentWillMount() {
    this.props.setProjectNavSection('releases');
    this.fetchData();
  },

  routeDidChange() {
    this.fetchData();
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
    var queryParams = router.getCurrentQuery();
    queryParams.limit = 50;

    return '/projects/' + params.orgId + '/' + params.projectId + '/releases/';
  },

  onPage(cursor) {
    var router = this.context.router;
    var params = router.getCurrentParams();
    var queryParams = router.getCurrentQuery();
    queryParams.cursor = cursor;

    router.transitionTo('projectReleases', params, queryParams);
  },

  render() {
    var router = this.context.router;
    var params = router.getCurrentParams();

    return (
      <div>
        {this.state.loading ?
          <LoadingIndicator />
        : (this.state.error ?
          <LoadingError onRetry={this.fetchData} />
        :
          <div>
            <h2>Releases</h2>
            <div className="release-header">
              <div className="row">
                <div className="col-md-7 col-sm-6 col-xs-6">Version</div>
                <div className="col-md-5 col-sm-6 col-xs-6 release-stats align-right">
                  New Events
                </div>
              </div>
            </div>
            <ul className="release-list">
                {this.state.releaseList.map((release) => {
                  var routeParams = {
                    orgId: params.orgId,
                    projectId: params.projectId,
                    version: release.version
                  };

                  return (
                    <li className="release">
                      <div className="row">
                        <div className="col-md-7 col-sm-6 col-xs-6">
                          <h4>
                          <Router.Link to="releaseDetails" params={routeParams} className="truncate">
                            {release.version}
                          </Router.Link>
                          </h4>
                          <div className="release-meta">
                            <span className="icon icon-clock"></span> <TimeSince date={release.dateCreated} /> by <a>dcramer</a>
                          </div>
                        </div>
                        <div className="col-md-5 col-sm-6 col-xs-6 release-stats">
                          <span className="release-count">N</span>
                        </div>
                      </div>
                    </li>
                  );
                })}
            </ul>
          </div>
        )}
        <Pagination pageLinks={this.state.pageLinks} onPage={this.onPage} />
      </div>
    );
  }
});

module.exports = ProjectReleases;
