import React from "react";

const TeamStatsBar = React.createClass({
  render() {
    return (
      <div className="row team-stats">
        <div className="col-md-3 stat-column">
          <span className="count">323</span>
          <span className="count-label">events seen</span>
        </div>
        <div className="col-md-3 stat-column">
          <span className="count">137</span>
          <span className="count-label">new events</span>
        </div>
        <div className="col-md-3 stat-column">
          <span className="count">16</span>
          <span className="count-label">releases</span>
        </div>
        <div className="col-md-3 stat-column align-right bad">
          <span className="count">20%</span>
          <span className="count-label">more than last week</span>
        </div>
      </div>
    );
  }
});

export default TeamStatsBar;

