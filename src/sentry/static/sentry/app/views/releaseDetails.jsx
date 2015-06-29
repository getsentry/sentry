var React = require("react");
var Reflux = require("reflux");
var Router = require("react-router");

var api = require("../api");
var BreadcrumbMixin = require("../mixins/breadcrumbMixin");
var LoadingError = require("../components/loadingError");
var LoadingIndicator = require("../components/loadingIndicator");
var PropTypes = require("../proptypes");
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

    return (
      <div className={this.props.className}>

      </div>
    );
  }
});

module.exports = GroupDetails;
