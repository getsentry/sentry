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
      <GroupList
        query={'release:"' + this.context.release.version + '"'}
        canSelectGroups={false} />
    );
  }
});

export default ReleaseAllEvents;

