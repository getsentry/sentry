import React from "react";
import Router from "react-router";
import GroupList from "../components/groupList";
import PropTypes from "../proptypes";

var ReleaseAllEvents = React.createClass({
  contextTypes: {
    router: React.PropTypes.func,
    release: PropTypes.AnyModel
  },

  render() {
    var params = this.context.router.getCurrentParams();
    return (
      <div>
        <div className="alert alert-block">
          <Router.Link to="stream" params={{
            orgId: params.orgId,
            projectId: params.projectId
          }} query={{
            query: "release:" + this.context.release.version
          }}>
            <span className="icon icon-open"></span> View all events in the stream
          </Router.Link>
        </div>
        <GroupList
          query={'release:"' + this.context.release.version + '"'}
          canSelectGroups={false} bulkActions={false} />
      </div>
    );
  }
});

export default ReleaseAllEvents;
