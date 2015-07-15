var React = require("react");
var Router = require("react-router");

var Version = React.createClass({
  contextTypes: {
    router: React.PropTypes.func
  },

  propTypes: {
    version: React.PropTypes.string.isRequired
  },

  render() {
    var version = this.props.version;
    var shortVersion = version.length === 40 ? version.substr(0, 12) : version;
    var params = this.context.router.getCurrentParams();

    return (
      <Router.Link
          to="releaseDetails"
          params={{
            orgId: params.orgId,
            projectId: params.projectId,
            version: version,
          }}>
        <span title={version}>{shortVersion}</span>
      </Router.Link>
    );
  }
});

module.exports = Version;
