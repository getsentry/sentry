/*** @jsx React.DOM */
var React = require("react");

var PropTypes = require("../../proptypes");

var AggregateEventDataSection = React.createClass({
  propTypes: {
    aggregate: PropTypes.Aggregate.isRequired,
    event: PropTypes.Event.isRequired,
    title: React.PropTypes.string.isRequired
  },

  render: function() {
    return (
      <div className="box">
        <div className="box-header">
            <h3>{this.props.title}</h3>
        </div>
        <div className="box-content with-padding">
          {this.props.children}
        </div>
      </div>
    );
  }
});

module.exports = AggregateEventDataSection;
