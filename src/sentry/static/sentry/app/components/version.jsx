import React from "react";
import Router from "react-router";

var Version = React.createClass({
  contextTypes: {
    router: React.PropTypes.func
  },

  propTypes: {
    version: React.PropTypes.string.isRequired,
  },

  getDefaultProps() {
    return {
      anchor: true
    };
  },

  render() {
    var version = this.props.version;
    var shortVersion = version.length === 40 ? version.substr(0, 12) : version;
    var params = this.context.router.getCurrentParams();
    if (this.props.anchor) {
      return (
        <Router.Link
            to="releaseDetails"
            params={{
              orgId: params.orgId,
              projectId: params.projectId,
              version: window.encodeURIComponent(version),
            }}>
          <span title={version}>{shortVersion}</span>
        </Router.Link>
      );
    }
    return <span title={version}>{shortVersion}</span>;
  }
});

export default Version;

