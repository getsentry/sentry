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
    return (
      <div>
        <div className="alert alert-block">
          <a href="#"><span className="icon icon-open"></span> View all events in the stream</a>
        </div>
        <GroupList
          query={'release:"' + this.context.release.version + '"'}
          canSelectGroups={false} bulkActions={false} />
      </div>
    );
  }
});

export default ReleaseAllEvents;
