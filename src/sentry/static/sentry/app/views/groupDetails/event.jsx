import React from "react";
import DateTime from "../../components/dateTime";
import FileSize from "../../components/fileSize";
import GroupEventEntries from "../../components/events/eventEntries";
import GroupState from "../../mixins/groupState";
import PropTypes from "../../proptypes";
import TimeSince from "../../components/timeSince";

import UserWidget from "./userWidget";
import ReleaseWidget from "./releaseWidget";

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
          <GroupEventEntries
              group={group}
              event={evt} />
        </div>
        <div className="col-md-3">
          <div className="event-stats group-stats">
            <h6><span>Meta</span></h6>
            <dl>
              <dt>ID:</dt>
              <dd className="truncate">{evt.eventID}</dd>
              <dt>When:</dt>
              <dd><TimeSince date={evt.dateCreated} /></dd>
              <dt>Date:</dt>
              <dd><DateTime date={evt.dateCreated} /></dd>
              <dt>Size:</dt>
              <dd><FileSize bytes={evt.size} /></dd>
            </dl>
            {evt.user &&
              <UserWidget data={evt.user} />
            }
            {evt.release &&
              <ReleaseWidget data={evt.release} />
            }
          </div>
        </div>
      </div>
    );
  }
});

export default GroupEvent;
