var React = require("react");
var Reflux = require("reflux");
var $ = require("jquery");

var api = require("../api");
var GroupActions = require("../actions/groupActions");
var GroupStore = require("../stores/groupStore");
var LoadingError = require("../components/loadingError");
var LoadingIndicator = require("../components/loadingIndicator");
var Pagination = require("../components/pagination");
var RouteMixin = require("../mixins/routeMixin");
var Sticky = require('react-sticky');
var StreamGroup = require('./stream/group');
var StreamActions = require('./stream/actions');
var StreamFilters = require('./stream/filters');
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
    var querystring = $.param(queryParams);

    return '/projects/' + params.orgId + '/' + params.projectId + '/releases/?' + querystring;
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
          <table className="release-list">
            <thead>
              <tr>
                <th>Version</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {this.state.releaseList.map((release) => {
                return (
                  <tr>
                    <td>{release.version}</td>
                    <td>{release.dateReleased || <span>&mdash;</span>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
        <Pagination pageLinks={this.state.pageLinks} onPage={this.onPage} />
      </div>
    );
  }
});

module.exports = ProjectReleases;
