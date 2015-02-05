/*** @jsx React.DOM */
var React = require("react");

var PropTypes = require("../../proptypes");

var AggregateEventTags = React.createClass({
  propTypes: {
    aggregate: PropTypes.Aggregate.isRequired,
    event: PropTypes.Event.isRequired
  },

  render() {
    var children = this.props.event.tags.map((tag) => {
      var key = tag[0];
      var value = tag[1];
      return (
        <li>
          {key} = {value}
        </li>
      );
    });

    return (
      <div id="tags" className="box">
        <div className="box-header">
          <h3>Tags</h3>
        </div>
        <div className="box-content with-padding">
          <ul className="mini-tag-list">
            {children}
          </ul>
        </div>
      </div>
    );
  }
});

module.exports = AggregateEventTags;

