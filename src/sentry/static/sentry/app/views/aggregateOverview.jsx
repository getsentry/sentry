/*** @jsx React.DOM */

var React = require("react");
var Reflux = require("reflux");
var Router = require("react-router");

var api = require("../api");
var AggregateActivity = require("./aggregate/activity");
var AggregateChart = require("./aggregate/chart");
var AggregateEventHeader = require("./aggregate/eventHeader");
var AggregateListStore = require("../stores/aggregateListStore");
var MemberListStore = require("../stores/memberListStore");
var PropTypes = require("../proptypes");
var utils = require("../utils");

var AggregateOverview = React.createClass({
  mixins: [Router.State],

  propTypes: {
    aggregate: PropTypes.Aggregate.isRequired,
    statsPeriod: React.PropTypes.string.isRequired
  },

  getInitialState: function(){
    return {
      event: null
    };
  },

  componentWillMount: function(){
    this.fetchEventData();
  },

  componentWillReceiveProps: function(nextProps) {
    var eventId = this.getParams().eventId || 'latest';
    console.log(nextProps);
    // if (this.)
    // this.fetchEventData();
  },

  fetchEventData: function(){
    var eventId = this.getParams().eventId || 'latest';
    api.request('/groups/' + this.props.aggregate.id + '/events/' + eventId + '/', {
      success: function(data) {
        this.setState({event: data});
      }.bind(this),
      error: function() {
        // TODO(dcramer):
      }
    });
  },

  render: function(){
    return (
      <div>
        <AggregateChart
            aggregate={this.props.aggregate}
            statsPeriod={this.props.statsPeriod} />
        <AggregateActivity aggregate={this.props.aggregate} />
        <AggregateEventHeader
            aggregate={this.props.aggregate}
            event={this.state.event} />
      </div>
    );
  }
});

module.exports = AggregateOverview;
