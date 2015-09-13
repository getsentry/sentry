import React from "react";
import EventEntries from "../../components/events/eventEntries";
import GroupState from "../../mixins/groupState";
import GroupSidebar from "../../components/group/sidebar";
import PropTypes from "../../proptypes";

var GroupEvent = React.createClass({
  mixins: [GroupState],

  propTypes: {
    event: PropTypes.Event.isRequired
  },

  render(){
    var group = this.getGroup();
    var evt = this.props.event;

    return (
      <div className="row event">
        <div className="col-md-9">
          <EventEntries group={group} event={evt} />
        </div>
        <div className="col-md-3">
          <GroupSidebar group={group} />
        </div>
      </div>
    );
  }
});

export default GroupEvent;
