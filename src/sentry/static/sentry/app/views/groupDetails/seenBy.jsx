/*** @jsx React.DOM */

var React = require("react");

var GroupSeenBy = React.createClass({
  render() {
    return (
      <div className="seen-by">
        <ul>
          <li>Seen by:</li>
        </ul>
      </div>
    );
  }
});

module.exports = GroupSeenBy;
