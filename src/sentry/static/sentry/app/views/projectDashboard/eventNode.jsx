import React from "react";
import {Link} from "react-router";
import Count from "../../components/count";
import PropTypes from "../../proptypes";
import TimeSince from "../../components/timeSince";
import ProjectState from "../../mixins/projectState";

var EventNode = React.createClass({
  propTypes: {
    group: PropTypes.Group.isRequired
  },

  mixins: [ProjectState],

  makeGroupLink(title) {
    var group = this.props.group;
    var org = this.getOrganization();

    let orgId = org.slug;
    let projectId = group.project.slug;
    let groupId = group.id;

    return (
      <Link to={`/${orgId}/${projectId}/group/${groupId}/`}>
        {title}
      </Link>
    );
  },

  render() {
    var group = this.props.group;
    var userCount = group.userCount;

    return (
      <li className="group">
        <div className="row">
          <div className="col-xs-8 event-details">
            <h3 className="truncate">{this.makeGroupLink(group.title)}</h3>
            <div className="event-message">{group.culprit}</div>
            <div className="event-extra">
              <ul>
                <li>
                  <span className="icon icon-clock"></span>
                  <TimeSince date={group.lastSeen} />
                  &nbsp;&mdash;&nbsp;
                  <TimeSince date={group.firstSeen} suffix="old" />
                </li>
              </ul>
            </div>
          </div>
          <div className="col-xs-2 event-count align-right">
            <Count value={group.count} />
          </div>
          <div className="col-xs-2 event-users align-right">
            <Count value={userCount} />
          </div>
        </div>
      </li>
    );
  }
});

export default EventNode;
