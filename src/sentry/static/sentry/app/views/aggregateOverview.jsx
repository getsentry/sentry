/*** @jsx React.DOM */

var React = require("react");
var Reflux = require("reflux");
var Router = require("react-router");

var api = require("../api");
var AggregateChart = require("./aggregate/chart");
var AggregateHeader = require("./aggregate/header");
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
      <div className="box">
        <div className="box-content with-padding">
          <AggregateChart aggregate={this.props.aggregate} />
        </div>
      </div>
    );
  }
});

module.exports = AggregateOverview;
