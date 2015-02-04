/*** @jsx React.DOM */

var React = require("react");
var Router = require("react-router");

var api = require("../api");
var AggregateActivity = require("./aggregate/activity");
var AggregateChart = require("./aggregate/chart");
var AggregateEvent = require("./aggregate/event");
var PropTypes = require("../proptypes");

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
      }.bind(this)
    });
  },

  render: function(){
    var agg = this.props.aggregate;
    var evt = this.state.event;

    return (
      <div>
        <div className="row">

          <div className="col-md-6">
            <AggregateActivity aggregate={agg} />
          </div>
          <div className="col-md-6">
            <AggregateChart
                aggregate={agg}
                statsPeriod={this.props.statsPeriod} />
                <div className="row">
                  <div className="col-md-6">
                    <h6>First seen</h6>
                    <h3>Jan 15, 2015</h3>
                    <h6>Last seen</h6>
                    <h3>Jan 15, 2015</h3>
                  </div>
                  <div className="col-md-6">
                    <h6>In release</h6>
                    <h3>cd5b4c4d93ad</h3>
                    <h6>Status</h6>
                    <h3>Unresolved</h3>
                  </div>
                </div>
          </div>
        </div>
        <div className="event-toolbar">
          <div className="pull-right">
            <div className="btn-group">
              <a href="#" className="btn btn-default btn-lg">Newer</a>
              <a href="#" className="btn btn-default btn-lg">Older</a>
            </div>
          </div>
          <ul className="nav nav-tabs">
            <li className="active"><a href="#">Tags</a></li>
            <li><a href="#">Exception</a></li>
            <li><a href="#">Request</a></li>
            <li><a href="#">Additional Data</a></li>
          </ul>
        </div>
        <div className="row">
          <div className="col-md-9">
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
          <div className="col-md-3 aggregate-sidebar">
            <h6>Sample ID</h6>
            <p><strong>fb2a9940cd5b4c4d93ad9fa8843</strong></p>

            <h6>Time</h6>
            <p><strong>Jan. 20, 2015, 8:22 p.m.</strong></p>

            <h6>User</h6>
            <p><strong><a href="#">tony@hawk.com</a></strong></p>
          </div>
        </div>
    </div>
    );
  }
});

module.exports = AggregateOverview;
