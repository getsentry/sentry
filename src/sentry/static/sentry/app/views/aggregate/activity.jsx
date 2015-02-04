/*** @jsx React.DOM */
var React = require("react");

var PropTypes = require("../../proptypes");

var AggregateActivity = React.createClass({
  propTypes: {
    aggregate: PropTypes.Aggregate.isRequired
  },

  render: function() {
    return (
      <div className="activity">
        <h5>Timeline</h5>
        <div className="activity-field">
          <textarea className="form-control" placeholder="Type a note and press enter" />
        </div>
        <ul className="activity">
          <li className="activity-item">
            <img className="avatar" src="" />
            <time>just now</time>
            <h6><a href="#">David Cramer</a></h6>
            <p>This seems fixed in riak-2.2.0. That is, it will likely still error somehow, but I think they addressed the BadStatusLine stuff.</p>
          </li>
          <li className="activity-item">
            <img className="avatar" src="" />
            <time>2h ago</time>
            <h6><a href="#">Sentry</a></h6>
            <p>Heads up, we just saw this event for the first time.</p>
          </li>
        </ul>
      </div>
    );
  }
});

module.exports = AggregateActivity;
