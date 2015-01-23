/*** @jsx React.DOM */

var React = require("react");
var Reflux = require("reflux");
var Router = require("react-router");

var api = require("../api");
var AggregateActivity = require("./aggregate/activity");
var AggregateChart = require("./aggregate/chart");
var AggregateEvent = require("./aggregate/event");
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
      event: null,
      eventIsLoading: true
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

    this.setState({eventIsLoading: true});

    api.request('/groups/' + this.props.aggregate.id + '/events/' + eventId + '/', {
      success: function(data) {
        this.setState({event: data});
      }.bind(this),
      error: function() {
        // TODO(dcramer):
      },
      complete: function() {
        this.setState({eventIsLoading: false});
      }
    });
  },

  render: function(){
    var agg = this.props.aggregate;
    var evt = this.state.event;

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
        {evt ?
          <AggregateEvent
              aggregate={agg}
              event={this.state.event} />
        : this.state.eventIsLoading &&
          <div className="loading">Loading event data..</div>
        }
      </div>
    );
  }
});

module.exports = AggregateOverview;
