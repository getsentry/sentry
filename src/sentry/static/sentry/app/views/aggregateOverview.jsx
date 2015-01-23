/*** @jsx React.DOM */

var React = require("react");
var Reflux = require("reflux");
var Router = require("react-router");

var api = require("../api");
var AggregateActivity = require("./aggregate/activity");
var AggregateChart = require("./aggregate/chart");
var AggregateListStore = require("../stores/aggregateListStore");
var MemberListStore = require("../stores/memberListStore");
var PropTypes = require("../proptypes");
var utils = require("../utils");

var AggregateOverview = React.createClass({
  propTypes: {
    aggregate: PropTypes.Aggregate.isRequired
  },

  render: function() {
    return (
      <div>
        <AggregateChart aggregate={this.props.aggregate} />
        <AggregateActivity aggregate={this.props.aggregate} />
      </div>
    );
  }
});

module.exports = AggregateOverview;
