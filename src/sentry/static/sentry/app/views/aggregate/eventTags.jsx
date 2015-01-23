/*** @jsx React.DOM */
var React = require("react");

var PropTypes = require("../../proptypes");

var AggregateEventTags = React.createClass({
  propTypes: {
    aggregate: PropTypes.Aggregate.isRequired
  },

  render: function() {
    return (
      <div id="tags" className="box">
        <div className="box-header">
          <h3>Tags</h3>
        </div>
        <div className="box-content with-padding">
          <ul className="mini-tag-list">
          </ul>
        </div>
      </div>
    );
  }
});

module.exports = AggregateEventTags;

