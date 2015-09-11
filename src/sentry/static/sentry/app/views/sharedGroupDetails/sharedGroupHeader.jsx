import React from "react";

import Count from "../../components/count";

var SharedGroupHeader = React.createClass({
  render() {
    var group = this.props.group,
        userCount = 0;

    if (group.tags.user !== undefined) {
      userCount = group.tags.user.count;
    }

    return (
      <div className="group-detail">
        <div className="row">
          <div className="col-sm-9 details">
            <h3>
              {group.title}
            </h3>
            <div className="event-message">
              <span className="message">{group.culprit}</span>
            </div>
          </div>
          <div className="col-sm-3 stats">
            <div className="row">
              <div className="col-xs-6 count align-right">
                <h6 className="nav-header">events</h6>
                <Count value={group.count} />
              </div>
              <div className="col-xs-6 count align-right">
                <h6 className="nav-header">users</h6>
                <Count value={userCount} />
              </div>
            </div>
          </div>
        </div>
        <ul className="nav nav-tabs">
          <li className="active"><a>Overview</a></li>
        </ul>
      </div>
    );
  }
});

export default SharedGroupHeader;
