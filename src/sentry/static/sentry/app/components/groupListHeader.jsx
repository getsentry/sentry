import React from "react";

var GroupListHeader = React.createClass({
  render() {
    return (
      <div className="group-header">
        <div className="stream-actions row">
          <div className="stream-actions-left col-md-7 col-sm-8 col-xs-8">
            Event
          </div>
          <div className="hidden-sm hidden-xs stream-actions-graph col-md-2 col-md-offset-1 align-right">
            Last 24 hours
          </div>
          <div className="stream-actions-occurrences align-right col-md-1 col-sm-2 col-xs-2">events</div>
          <div className="stream-actions-users align-right col-md-1 col-sm-2 col-xs-2">users</div>
        </div>
      </div>
    );
  }
});

export default GroupListHeader;
