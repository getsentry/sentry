/*** @jsx React.DOM */

var React = require("react");
var Reflux = require("reflux");
var Router = require("react-router");

var api = require("../api");
var AggregateActivity = require("./aggregate/activity");
var AggregateChart = require("./aggregate/chart");
var AggregateEventHeader = require("./aggregate/eventHeader");
var AggregateEventTags = require("./aggregate/eventTags");
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
    var agg = this.props.aggregate;

    return (
      <div>
        <AggregateChart
            aggregate={agg}
            statsPeriod={this.props.statsPeriod} />
        <AggregateActivity aggregate={agg} />
        {agg.status === 'muted' &&
          <div className="alert alert-info">
            This event has been muted. You will not be notified of any changes and it will not show up in the default feed.
          </div>
        }
        // TODO(dcramer): we could move these into some kind of
        // AggregateEvent component
        <AggregateEventHeader
            aggregate={agg}
            event={this.state.event} />
        <AggregateEventTags
            aggregate={agg}
            event={this.state.event} />
      </div>
    );
  }
});

module.exports = AggregateOverview;
